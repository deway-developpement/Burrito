pipeline {
  agent {
    kubernetes {
      defaultContainer 'builder'
      yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: builder
    image: node:18-bullseye
    tty: true
    command:
      - cat
    volumeMounts:
      - name: containerd-sock
        mountPath: /run/k3s/containerd/containerd.sock
        readOnly: false
  volumes:
    - name: containerd-sock
      hostPath:
        path: /run/k3s/containerd/containerd.sock
"""
    }
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    string(
      name: 'K8S_NAMESPACE',
      defaultValue: 'evaluation-system',
      description: 'Target Kubernetes namespace'
    )
    string(
      name: 'KUBE_CONTEXT',
      defaultValue: '',
      description: 'Optional kube-context override (leave empty to use default from kubeconfig)'
    )
  }

  environment {
    KUBECONFIG_CRED   = 'kubeconfig-burrito' // secret-text credential containing kubeconfig
    CONTAINERD_SOCKET = '/run/k3s/containerd/containerd.sock'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        container('builder') {
          sh '''
            set -e
            # Install kubectl (lightweight)
            if ! command -v kubectl >/dev/null 2>&1; then
              curl -sLo /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
              chmod +x /usr/local/bin/kubectl
            fi
            # Install nerdctl (static binary)
            if ! command -v nerdctl >/dev/null 2>&1; then
              NERD_VERSION="1.7.7"
              curl -sL "https://github.com/containerd/nerdctl/releases/download/v${NERD_VERSION}/nerdctl-${NERD_VERSION}-linux-amd64.tar.gz" | tar -xz -C /usr/local/bin nerdctl
            fi
            cd backend
            npm ci --force
          '''
        }
      }
    }

    stage('Build Images (containerd local)') {
      steps {
        container('builder') {
          sh '''
            set -e
            BUILDKIT_VERSION="0.13.2"
            CONTAINERD_SOCKET="${CONTAINERD_SOCKET}"
            export BUILDKIT_HOST="unix:///tmp/buildkitd.sock"

            # Install nerdctl if missing
            if ! command -v nerdctl >/dev/null 2>&1; then
              NERD_VERSION="1.7.7"
              curl -sL "https://github.com/containerd/nerdctl/releases/download/v${NERD_VERSION}/nerdctl-${NERD_VERSION}-linux-amd64.tar.gz" | tar -xz -C /usr/local/bin nerdctl
            fi

            # Install buildkit binaries if missing
            if ! command -v buildkitd >/dev/null 2>&1; then
              curl -sL "https://github.com/moby/buildkit/releases/download/v${BUILDKIT_VERSION}/buildkit-v${BUILDKIT_VERSION}.linux-amd64.tar.gz" | tar -xz -C /usr/local
              ln -sf /usr/local/bin/buildctl /usr/local/bin/buildctl-daemonless.sh || true
            fi

            # Start buildkitd pointing at containerd
            rm -f /tmp/buildkitd.sock
            buildkitd --address "${BUILDKIT_HOST}" --containerd-address "${CONTAINERD_SOCKET}" --oci-worker-snapshotter overlayfs >/tmp/buildkitd.log 2>&1 &
            BKPID=$!
            sleep 2
            trap 'if kill -0 $BKPID 2>/dev/null; then kill $BKPID; fi' EXIT

            # Wait for buildkitd socket
            for i in $(seq 1 10); do
              if [ -S /tmp/buildkitd.sock ]; then
                break
              fi
              sleep 1
            done
            if [ ! -S /tmp/buildkitd.sock ]; then
              echo "buildkitd failed to start; log follows:"
              cat /tmp/buildkitd.log
              exit 1
            fi

            cd backend
            for svc in api-gateway users-ms forms-ms evaluations-ms; do
              nerdctl --address "${CONTAINERD_SOCKET}" --namespace k8s.io build --build-arg SERVICE_NAME=${svc} -t burrito-${svc}:${BUILD_NUMBER} .
              nerdctl --address "${CONTAINERD_SOCKET}" --namespace k8s.io tag burrito-${svc}:${BUILD_NUMBER} burrito-${svc}:latest
            done

            if kill -0 $BKPID 2>/dev/null; then
              kill $BKPID
            fi
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        container('builder') {
          withCredentials([string(credentialsId: env.KUBECONFIG_CRED, variable: 'KUBECONFIG_CONTENT')]) {
            sh '''
              set -e
              export KUBECONFIG=/tmp/kubeconfig
              printf "%s" "$KUBECONFIG_CONTENT" > "$KUBECONFIG"
              chmod 600 "$KUBECONFIG"

              if [ -n "$KUBE_CONTEXT" ]; then
                kubectl config use-context "$KUBE_CONTEXT"
              fi

              # Ensure base manifests are present
              kubectl apply -f backend/k8s/evaluation-system.yaml

              # Update deployments with freshly built images
              kubectl set image deployment/api-gateway api-gateway=burrito-api-gateway:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/users-ms users-ms=burrito-users-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/forms-ms forms-ms=burrito-forms-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/evaluations-ms evaluations-ms=burrito-evaluations-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"

              kubectl rollout status deployment/api-gateway -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/users-ms -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/forms-ms -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/evaluations-ms -n "$K8S_NAMESPACE"
            '''
          }
        }
      }
    }
  }
}
