variable "kubeconfig_path" {
  type        = string
  description = "Path to the kubeconfig produced by Ansible bootstrap"
  default     = "~/.kube/burrito-k3s.yaml"
}

variable "jenkins_domain" {
  type        = string
  description = "Public hostname for Jenkins ingress"
  default     = "jenkins.burrito.deway.fr"
}

variable "jenkins_admin_user" {
  type        = string
  description = "Admin username for Jenkins controller"
  default     = "admin"
}

variable "jenkins_admin_password" {
  type        = string
  description = "Admin password for Jenkins controller"
  sensitive   = true
  default     = "admin"
}

variable "burrito_repo_url" {
  type        = string
  description = "Git URL for the Burrito repository (used by the Jenkins pipeline)"
  default     = "https://github.com/deway-developpement/Burrito.git"
}

variable "burrito_repo_branch" {
  type        = string
  description = "Branch to build for the Burrito pipeline job"
  default     = "main"
}

variable "k8s_namespace" {
  type        = string
  description = "Kubernetes namespace for Burrito workloads"
  default     = "evaluation-system"
}

variable "burrito_database_username" {
  type        = string
  description = "Placeholder database username for Jenkins credentials"
  default     = "root"
}

variable "burrito_database_password" {
  type        = string
  description = "Placeholder database password for Jenkins credentials"
  default     = "root"
  sensitive   = true
}

variable "burrito_jwt_secret" {
  type        = string
  description = "Placeholder JWT secret for Jenkins credentials"
  default     = "Nwrb2!1501BvS85pB@u9%*vm*4B#D37o"
  sensitive   = true
}

variable "burrito_jwt_expires_in" {
  type        = string
  description = "Placeholder JWT access token TTL"
  default     = "30min"
}

variable "burrito_jwt_refresh_expires_in" {
  type        = string
  description = "Placeholder JWT refresh token TTL"
  default     = "30d"
}

variable "burrito_smtp_user" {
  type        = string
  description = "Placeholder SMTP user or API key"
  default     = "smtp-user"
}

variable "burrito_smtp_pass" {
  type        = string
  description = "Placeholder SMTP password or API secret"
  default     = "smtp-pass"
  sensitive   = true
}

variable "burrito_huggingface_hub_token" {
  type        = string
  description = "Hugging Face Hub token for intelligence-ms"
  default     = "huggingface-token"
  sensitive   = true
}

variable "burrito_github_app_id" {
  type        = string
  description = "GitHub App ID used by Jenkins for GitOps promotion pushes"
  default     = "2961088"
}

variable "burrito_github_app_installation_id" {
  type        = string
  description = "GitHub App installation ID used by Jenkins for GitOps promotion pushes"
  default     = "112755057"
}

variable "burrito_github_app_private_key_pem" {
  type        = string
  description = "GitHub App private key (PEM) used to mint installation tokens in Jenkins"
  default     = ""
  sensitive   = true
}
