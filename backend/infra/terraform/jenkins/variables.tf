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
