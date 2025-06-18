#!/bin/sh
set -e

# Default libvips version
DEFAULT_VIPS_VERSION="8.16.1"
VIPS_VERSION="$DEFAULT_VIPS_VERSION"
NO_CPP=false

# Function to uninstall libvips
uninstall_libvips() {
  echo "Uninstalling libvips..."
  sudo rm -f /usr/local/bin/vips*
  sudo rm -rf /usr/local/lib/libvips*
  sudo rm -rf /usr/local/lib/vips-modules-*
  sudo rm -rf /usr/local/include/vips
  sudo rm -rf /usr/local/share/vips
  sudo rm -f /usr/local/lib/pkgconfig/vips*.pc
  sudo rm -f /usr/local/share/man/man1/vips.1
  sudo rm -rf /Library/Caches/com.apple.xbs/Binaries/DyldSharedCache_arm64e
  sudo update_dyld_shared_cache
  echo "libvips uninstalled successfully"
}

# Parse command-line arguments
REINSTALL=false
while [ $# -gt 0 ]; do
  case "$1" in
  --reinstall | -r)
    REINSTALL=true
    shift
    ;;
  --version | -v)
    if [ -n "$2" ]; then
      VIPS_VERSION="$2"
      shift 2
    else
      echo "Error: --version requires a version number (e.g., --version 8.17.0)"
      exit 1
    fi
    ;;
  --no-cpp)
    NO_CPP=true
    shift
    ;;
  *)
    echo "Unknown option: $1"
    echo "Usage: $0 [--reinstall|-r] [--version|-v <version>] [--no-cpp]"
    exit 1
    ;;
  esac
done

# Validate version format (x.y.z)
if ! echo "$VIPS_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Invalid version format '$VIPS_VERSION'. Expected format: x.y.z (e.g., 8.16.1)"
  exit 1
fi

# Check if libvips is installed and matches the desired version
if command -v vips >/dev/null 2>&1; then
  INSTALLED_VERSION=$(vips --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
  if [ "$INSTALLED_VERSION" = "$VIPS_VERSION" ] && [ "$REINSTALL" = false ]; then
    echo "libvips $VIPS_VERSION is already installed. Use --reinstall or -r to force reinstall."
    exit 0
  elif [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" != "$VIPS_VERSION" ]; then
    echo "libvips $INSTALLED_VERSION is installed, but $VIPS_VERSION was requested. Forcing reinstall."
    uninstall_libvips
  fi
fi

# Install Homebrew if not installed
if ! command -v brew >/dev/null 2>&1; then
  /bin/sh -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  test -d /opt/homebrew/bin && eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Uninstall any Homebrew vips to avoid conflicts
brew uninstall vips || true

# Update Homebrew and install dependencies
brew update
brew install meson ninja pkg-config gcc glib libxml2 orc jpeg libpng libtiff webp libheif librsvg giflib poppler fftw cairo gobject-introspection openslide

# Download and build libvips with timeout
wget -O vips.tar.xz https://github.com/libvips/libvips/releases/download/v$VIPS_VERSION/vips-$VIPS_VERSION.tar.xz &&
  tar xf vips.tar.xz &&
  cd vips-$VIPS_VERSION &&
  meson setup build --wipe \
    --prefix=/usr/local \
    -Djpeg=enabled \
    -Dpng=enabled \
    -Dtiff=enabled \
    -Dwebp=enabled \
    -Dheif=enabled \
    -Drsvg=enabled \
    -Dcgif=enabled \
    -Dpoppler=enabled \
    -Dorc=enabled \
    -Dopenslide=enabled \
    -Dfftw=enabled \
    -Ddeprecated=false \
    $([ "$NO_CPP" = true ] && echo "-Dcplusplus=false") &&
  cd build &&
  ninja -v &&
  sudo ninja install &&
  cd ../.. &&
  rm -rf vips-$VIPS_VERSION vips.tar.xz

# Verify installation
vips --version && vips --vips-config
