#!/usr/bin/env bash
# Cria a VM do MySuperStore (VM.Standard.A1.Flex, Always Free) no OCI.
#
# Rode SOMENTE no OCI Cloud Shell (ícone ">_" no topo do console), que já está
# autenticado na tenancy. Reaproveita a VCN/sub-rede pública existente
# (mercadinhosys-publica), onde as portas 80/443 já estão liberadas.
#
# São Paulo costuma ficar sem capacidade de A1: o script tenta de novo a cada
# INTERVAL segundos até MAX_TRIES. Se nunca conseguir, a saída definitiva é
# converter a conta para Pay As You Go (recursos Always Free continuam grátis).
#
# Uso:  bash cloudshell-create-a1.sh
#       OCPUS=4 MEM=24 bash cloudshell-create-a1.sh   # usa a cota A1 inteira
set -euo pipefail

REGION=sa-saopaulo-1
NAME=${NAME:-mysuperstore-prod}
OCPUS=${OCPUS:-2}
MEM=${MEM:-12}
BOOT_GB=${BOOT_GB:-50}
SUBNET_NAME=${SUBNET_NAME:-mercadinhosys-publica}
INTERVAL=${INTERVAL:-60}
MAX_TRIES=${MAX_TRIES:-15}
COMP=${OCI_TENANCY:?Rode no OCI Cloud Shell (OCI_TENANCY não definido)}

KEYFILE=$(mktemp)
trap 'rm -f "$KEYFILE"' EXIT
# Chave PÚBLICA (ssh-key-2026-10-05) — a mesma das VMs atuais.
cat > "$KEYFILE" <<'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC+zkaks0CW47XAZZ8EqZsqYbuiRveKTAUyVgVy/clVjBxs8S/OMeHZPY6VfP6g7L4CHqzDXNRPqyk9f/hiYZaOhh/hwuR/az9qLybBsqx/VBnX8EOs1NtZZzNg0InT1q/0QogUYDZfOG8T6nnNGnJABrmJ0r81C8cFxSKXp9qSPiUt0XcL/4py9zpE2eo+BlfRyT8nCLufLsvXqIEgy8aLJOhxvJf0/7fWGPOR8LQU5EbQtu9jjNwBZn1WY997rOAIKnOBEqF+DZoET3HJbVeIGmzWwMtGcDpscshHZzO59Ztc3+P8+1r4goQh//tiZpt3cFE63uPl3oU5eeoUvUqH ssh-key-2026-10-05
EOF

oci_() { oci --region "$REGION" "$@"; }

show_ip() {
  local ip
  ip=$(oci_ compute instance list-vnics --instance-id "$1" --query 'data[0]."public-ip"' --raw-output)
  echo
  echo "=================================================="
  echo " VM pronta: $NAME"
  echo " IP público: $ip"
  echo " Envie este IP para o Claude continuar o deploy."
  echo "=================================================="
}

existing=$(oci_ compute instance list -c "$COMP" --display-name "$NAME" \
  --query "data[?\"lifecycle-state\"!='TERMINATED'] | [0].id" --raw-output 2>/dev/null || true)
if [ -n "$existing" ] && [ "$existing" != "null" ]; then
  echo "Já existe uma VM '$NAME' ($existing)."
  show_ip "$existing"
  exit 0
fi

AD=$(oci_ iam availability-domain list -c "$COMP" --query 'data[0].name' --raw-output)
SUBNET=$(oci_ network subnet list -c "$COMP" --display-name "$SUBNET_NAME" --query 'data[0].id' --raw-output)
IMAGE=$(oci_ compute image list -c "$COMP" --operating-system "Canonical Ubuntu" \
  --operating-system-version "24.04" --shape VM.Standard.A1.Flex \
  --sort-by TIMECREATED --sort-order DESC \
  --query "data[?!contains(\"display-name\", 'Minimal')] | [0].id" --raw-output)

for v in AD SUBNET IMAGE; do
  if [ -z "${!v}" ] || [ "${!v}" = "null" ]; then echo "Não encontrei $v." >&2; exit 1; fi
done
echo "AD=$AD"
echo "Sub-rede=$SUBNET_NAME"
echo "Imagem=$(oci_ compute image get --image-id "$IMAGE" --query 'data."display-name"' --raw-output)"
echo "Shape=VM.Standard.A1.Flex ${OCPUS} OCPU / ${MEM} GB, disco ${BOOT_GB} GB"

for try in $(seq 1 "$MAX_TRIES"); do
  echo "[$(date +%H:%M:%S)] Tentativa $try/$MAX_TRIES..."
  set +e
  out=$(oci_ compute instance launch -c "$COMP" --availability-domain "$AD" \
    --display-name "$NAME" --shape VM.Standard.A1.Flex \
    --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEM}" \
    --image-id "$IMAGE" --boot-volume-size-in-gbs "$BOOT_GB" \
    --subnet-id "$SUBNET" --assign-public-ip true \
    --ssh-authorized-keys-file "$KEYFILE" \
    --wait-for-state RUNNING --max-wait-seconds 900 \
    --query 'data.id' --raw-output 2>&1)
  rc=$?
  set -e
  if [ $rc -eq 0 ]; then
    id=$(printf '%s\n' "$out" | grep -o 'ocid1\.instance[^" ]*' | head -1)
    show_ip "$id"
    exit 0
  fi
  if printf '%s' "$out" | grep -qiE 'out of host capacity|capacity|TooManyRequests'; then
    echo "  Sem capacidade de A1 agora. Nova tentativa em ${INTERVAL}s."
    sleep "$INTERVAL"
    continue
  fi
  echo "Falha que não é de capacidade:" >&2
  printf '%s\n' "$out" | tail -20 >&2
  exit 1
done

echo
echo "Sem capacidade após $MAX_TRIES tentativas. Opções:"
echo "  1) Rodar de novo mais tarde (madrugada costuma liberar)."
echo "  2) Converter a conta para Pay As You Go (Always Free continua grátis) e rodar de novo."
exit 2
