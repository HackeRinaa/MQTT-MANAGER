#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/mosquitto/certs"

mkdir -p "${CERT_DIR}"

if [[ -f "${CERT_DIR}/ca.crt" || -f "${CERT_DIR}/server.crt" || -f "${CERT_DIR}/server.key" ]]; then
  echo "Certificate files already exist in ${CERT_DIR}."
  echo "Delete them manually if you want to regenerate."
  exit 1
fi

DOMAIN="${MQTT_DOMAIN:-localhost}"
DAYS="${TLS_VALID_DAYS:-825}"

# Prevent Git Bash/MSYS from rewriting OpenSSL subject strings like /CN=...
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* || "${OSTYPE:-}" == win32* ]]; then
  export MSYS_NO_PATHCONV=1
  export MSYS2_ARG_CONV_EXCL="*"
fi

echo "Generating CA and server certificate for ${DOMAIN}..."

openssl req -x509 -newkey rsa:4096 -sha256 -days "${DAYS}" -nodes \
  -subj "/CN=WEMORE MQTT CA" \
  -keyout "${CERT_DIR}/ca.key" \
  -out "${CERT_DIR}/ca.crt"

openssl req -new -newkey rsa:4096 -nodes \
  -subj "/CN=${DOMAIN}" \
  -keyout "${CERT_DIR}/server.key" \
  -out "${CERT_DIR}/server.csr"

cat > "${CERT_DIR}/server.ext" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alt_names

[alt_names]
DNS.1=${DOMAIN}
DNS.2=localhost
IP.1=127.0.0.1
EOF

openssl x509 -req -in "${CERT_DIR}/server.csr" \
  -CA "${CERT_DIR}/ca.crt" \
  -CAkey "${CERT_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERT_DIR}/server.crt" \
  -days "${DAYS}" -sha256 \
  -extfile "${CERT_DIR}/server.ext"

rm -f "${CERT_DIR}/server.csr" "${CERT_DIR}/ca.srl" "${CERT_DIR}/server.ext"
chmod 600 "${CERT_DIR}/server.key" "${CERT_DIR}/ca.key"

echo "Certificates generated under ${CERT_DIR}"
echo "For production, replace with CA-issued certs and private key."
