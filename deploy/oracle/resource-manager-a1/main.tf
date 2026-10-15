# Stack do OCI Resource Manager: VM A1.Flex do MySuperStore (Always Free).
# Reaproveita a sub-rede pública existente (mercadinhosys-publica).
variable "compartment_ocid" {}
variable "region" {}
variable "ocpus" { default = 2 }
variable "memory_gbs" { default = 12 }
variable "boot_gbs" { default = 50 }
variable "subnet_name" { default = "mercadinhosys-publica" }

provider "oci" { region = var.region }

data "oci_identity_availability_domains" "ads" { compartment_id = var.compartment_ocid }

data "oci_core_subnets" "pub" {
  compartment_id = var.compartment_ocid
  display_name   = var.subnet_name
}

data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
  filter {
    name   = "display_name"
    values = ["^Canonical-Ubuntu-24\.04-aarch64-.*"]
    regex  = true
  }
}

resource "oci_core_instance" "mysuperstore" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "mysuperstore-prod"
  shape               = "VM.Standard.A1.Flex"
  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gbs
  }
  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_gbs
  }
  create_vnic_details {
    subnet_id        = data.oci_core_subnets.pub.subnets[0].id
    assign_public_ip = true
    display_name     = "mysuperstore-vnic"
  }
  metadata = {
    ssh_authorized_keys = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC+zkaks0CW47XAZZ8EqZsqYbuiRveKTAUyVgVy/clVjBxs8S/OMeHZPY6VfP6g7L4CHqzDXNRPqyk9f/hiYZaOhh/hwuR/az9qLybBsqx/VBnX8EOs1NtZZzNg0InT1q/0QogUYDZfOG8T6nnNGnJABrmJ0r81C8cFxSKXp9qSPiUt0XcL/4py9zpE2eo+BlfRyT8nCLufLsvXqIEgy8aLJOhxvJf0/7fWGPOR8LQU5EbQtu9jjNwBZn1WY997rOAIKnOBEqF+DZoET3HJbVeIGmzWwMtGcDpscshHZzO59Ztc3+P8+1r4goQh//tiZpt3cFE63uPl3oU5eeoUvUqH ssh-key-2026-10-05"
  }
  availability_config { recovery_action = "RESTORE_INSTANCE" }
  instance_options { are_legacy_imds_endpoints_disabled = true }
}

output "public_ip" { value = oci_core_instance.mysuperstore.public_ip }
output "image" { value = data.oci_core_images.ubuntu.images[0].display_name }
