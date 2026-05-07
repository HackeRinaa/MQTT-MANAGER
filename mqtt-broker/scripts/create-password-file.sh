#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASSWORD_FILE="${ROOT_DIR}/mosquitto/config/passwords"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <username> <password> [<username> <password> ...]"
  echo "Example: $0 generator-client pass123 hmd-client pass456"
  exit 1
fi

if (( $# % 2 != 0 )); then
  echo "Error: provide username/password pairs."
  exit 1
fi

mkdir -p "$(dirname "${PASSWORD_FILE}")"
touch "${PASSWORD_FILE}"

run_passwd() {
  local create_flag="$1"
  local user="$2"
  local pass="$3"

  if command -v mosquitto_passwd >/dev/null 2>&1; then
    if [[ "${create_flag}" == "create" ]]; then
      mosquitto_passwd -b -c "${PASSWORD_FILE}" "${user}" "${pass}"
    else
      mosquitto_passwd -b "${PASSWORD_FILE}" "${user}" "${pass}"
    fi
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "Error: neither mosquitto_passwd nor docker is available."
    echo "Install Mosquitto tools or Docker Desktop and retry."
    exit 1
  fi

  if [[ "${create_flag}" == "create" ]]; then
    docker run --rm \
      -v "${ROOT_DIR}/mosquitto/config:/mosquitto/config" \
      eclipse-mosquitto:2 \
      mosquitto_passwd -b -c /mosquitto/config/passwords "${user}" "${pass}"
  else
    docker run --rm \
      -v "${ROOT_DIR}/mosquitto/config:/mosquitto/config" \
      eclipse-mosquitto:2 \
      mosquitto_passwd -b /mosquitto/config/passwords "${user}" "${pass}"
  fi
}

first_pair=true
while [[ $# -gt 0 ]]; do
  user="$1"
  pass="$2"
  shift 2

  if [[ "${first_pair}" == true && ! -s "${PASSWORD_FILE}" ]]; then
    run_passwd "create" "${user}" "${pass}"
    first_pair=false
  else
    run_passwd "update" "${user}" "${pass}"
  fi
done

echo "Updated ${PASSWORD_FILE}"
