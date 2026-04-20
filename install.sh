#!/usr/bin/env bash
set -euo pipefail

# Colors (only if terminal)
Color_Off=''
Red=''
Green=''
Dim=''
Bold_White=''
Bold_Green=''

if [[ -t 1 ]]; then
  Color_Off='\033[0m'
  Red='\033[0;31m'
  Green='\033[0;32m'
  Dim='\033[0;2m'
  Bold_Green='\033[1;32m'
  Bold_White='\033[1m'
fi

error() {
  echo -e "${Red}error${Color_Off}:" "$@" >&2
  exit 1
}

info() {
  echo -e "${Dim}$@${Color_Off}"
}

info_bold() {
  echo -e "${Bold_White}$@${Color_Off}"
}

success() {
  echo -e "${Green}$@${Color_Off}"
}

tildify() {
  if [[ $1 = $HOME/* ]]; then
    local replacement=\~/
    echo "${1/$HOME\//$replacement}"
  else
    echo "$1"
  fi
}

# Check if Linux
if [[ $(uname -s) != "Linux" ]]; then
  error "agent-notify now targets Linux binaries in this fork"
fi

# Detect architecture
case $(uname -m) in
  arm64|aarch64)
    target="agent-notify-linux-arm64"
    binary="agent-notify-arm64"
    ;;
  x86_64|amd64)
    target="agent-notify-linux-x64"
    binary="agent-notify-x64"
    ;;
  *)
    error "Unsupported architecture: $(uname -m)"
    ;;
esac

# GitHub repo candidates
# Order:
# 1) explicit override
# 2) preferred repository (this forked project namespace)
AGENT_NOTIFY_REPOS=(
  "${AGENT_NOTIFY_REPO:-https://github.com/heavygee/agent-notify-tmux}"
)

download_uri=""
for repo in "${AGENT_NOTIFY_REPOS[@]}"; do
  candidate_uri="$repo/releases/latest/download/$target.tar.gz"
  if curl --silent --fail --head "$candidate_uri" >/dev/null 2>&1; then
    download_uri="$candidate_uri"
    break
  fi
done

if [[ -z "$download_uri" ]]; then
  error "Could not resolve a valid release URL for $target"
fi

# Install location
install_dir="$HOME/.local/bin"
exe="$install_dir/agent-notify"

if [[ ! -d $install_dir ]]; then
  mkdir -p "$install_dir" ||
    error "Failed to create install directory \"$install_dir\""
fi

# Create temp directory
tmp_dir=$(mktemp -d) || error "Failed to create temp directory"
trap "rm -rf '$tmp_dir'" EXIT

# Download and extract
curl --fail --location --progress-bar --output "$tmp_dir/$target.tar.gz" "$download_uri" ||
  error "Failed to download agent-notify from \"$download_uri\""

tar -xzf "$tmp_dir/$target.tar.gz" -C "$tmp_dir" ||
  error "Failed to extract agent-notify"

mv "$tmp_dir/$binary" "$exe" ||
  error "Failed to install agent-notify to \"$exe\""

chmod +x "$exe" ||
  error "Failed to set permissions on agent-notify executable"

env_dir="$HOME/.config/agent-notify"
env_file="$env_dir/.env"
if [[ ! -f $env_file ]]; then
  mkdir -p "$env_dir" || error "Failed to create ${env_dir}"
  cat <<'EOF' > "$env_file"
# agent-notify runtime environment
# Keep secrets in this file, not in hooks.
# This file is optional. Set only what you need to override.

AGENT_NOTIFY_VOICE_MODE=local
AGENT_NOTIFY_VOICE_URL=http://localhost:18008/v1/audio/speech
AGENT_NOTIFY_VOICE_TIMEOUT=30
#AGENT_NOTIFY_VOICE_INCLUDE_CONTEXT=0

AGENT_NOTIFY_SUMMARY_ENABLED=1
AGENT_NOTIFY_SUMMARY_PRIMARY_URL=http://100.121.154.23:8080/v1/chat/completions
AGENT_NOTIFY_SUMMARY_PRIMARY_MODEL=qwen2.5-1.5b-instruct-q8_0
AGENT_NOTIFY_SUMMARY_FALLBACK_URL=https://api.openai.com/v1/chat/completions
AGENT_NOTIFY_SUMMARY_FALLBACK_MODEL=gpt-5.4-mini
#AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY=
#AGENT_NOTIFY_VOICE_API_KEY=
# Tip: set AGENT_NOTIFY_SUMMARY_FALLBACK_API_KEY (recommended) or AGENT_NOTIFY_VOICE_API_KEY.
EOF
fi

success "agent-notify was installed successfully to $Bold_Green$(tildify "$exe")"

if command -v agent-notify >/dev/null; then
  echo "Run 'agent-notify' to get started"
  exit
fi

refresh_command=''
tilde_bin_dir=$(tildify "$install_dir")

echo

case $(basename "$SHELL") in
  zsh)
    commands=(
      "export PATH=\"$install_dir:\$PATH\""
    )
    zsh_config=$HOME/.zshrc
    tilde_zsh_config=$(tildify "$zsh_config")

    if [[ -w $zsh_config ]]; then
      {
        echo -e '\n# agent-notify'
        for command in "${commands[@]}"; do
          echo "$command"
        done
      } >>"$zsh_config"

      info "Added \"$tilde_bin_dir\" to \$PATH in \"$tilde_zsh_config\""
      refresh_command="exec $SHELL"
    else
      echo "Manually add the directory to $tilde_zsh_config (or similar):"
      for command in "${commands[@]}"; do
        info_bold "  $command"
      done
    fi
    ;;
  bash)
    commands=(
      "export PATH=\"$install_dir:\$PATH\""
    )
    bash_configs=(
      "$HOME/.bashrc"
      "$HOME/.bash_profile"
    )
    set_manually=true

    for bash_config in "${bash_configs[@]}"; do
      tilde_bash_config=$(tildify "$bash_config")

      if [[ -w $bash_config ]]; then
        {
          echo -e '\n# agent-notify'
          for command in "${commands[@]}"; do
            echo "$command"
          done
        } >>"$bash_config"

        info "Added \"$tilde_bin_dir\" to \$PATH in \"$tilde_bash_config\""
        refresh_command="source $bash_config"
        set_manually=false
        break
      fi
    done

    if [[ $set_manually = true ]]; then
      echo "Manually add the directory to ~/.bashrc (or similar):"
      for command in "${commands[@]}"; do
        info_bold "  $command"
      done
    fi
    ;;
  *)
    echo "Manually add the directory to ~/.bashrc (or similar):"
    info_bold "  export PATH=\"$install_dir:\$PATH\""
    ;;
esac

echo
info "To get started, run:"
echo

if [[ $refresh_command ]]; then
  info_bold "  $refresh_command"
fi

info_bold "  agent-notify"
