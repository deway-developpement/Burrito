terraform {
  required_version = ">= 1.5.0"

  required_providers {
    jenkins = {
      source  = "taiidani/jenkins"
      version = "~> 0.0"
    }
  }
}

provider "jenkins" {
  server_url = "https://${var.jenkins_domain}"
  username   = var.jenkins_admin_user
  password   = var.jenkins_admin_password
}
