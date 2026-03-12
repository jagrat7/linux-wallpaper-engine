# Maintainer: Your Name <your@email.com>
# Contributor: jagrat7 <jagrat7@github.com>
# 
# This PKGBUILD downloads the source from GitHub and builds the Electron app

pkgname=linux-wallpaper-engine
pkgver=0.3.3
pkgrel=1
pkgdesc="A modern desktop GUI for linux-wallpaperengine - browse, manage, and apply Steam Wallpaper Engine wallpapers on Linux"
arch=('x86_64')
url="https://github.com/jagrat7/linux-wallpaper-engine"
license=('MIT')
depends=('electron>=39' 'gtk3' 'libnotify' 'libxtst' 'libxss' 'libconfig' 'webkit2gtk-4.1' 'linux-wallpaperengine-git')
makedepends=('git' 'npm' 'nodejs')
provides=('linux-wallpaper-engine')
source=("${pkgname}::git+https://github.com/jagrat7/linux-wallpaper-engine.git#tag=${pkgver}")
sha256sums=('SKIP')

build() {
    cd "$pkgname"
    
    # Use system electron instead of downloading
    export ELECTRON_SKIP_BINARY_DOWNLOAD=1
    export ELECTRON_OVERRIDE_DIST_PATH=/usr/lib/electron
    
    # Install npm dependencies
    npm install
    
    # Package the electron app (without making distributable formats)
    npm run package
}

package() {
    cd "$pkgname"
    
    # Create directory structure
    install -dm755 "$pkgdir/usr/share/$pkgname"
    install -dm755 "$pkgdir/usr/share/pixmaps"
    install -dm755 "$pkgdir/usr/bin"
    
    # Copy the packaged app
    cp -r out/*/resources/app.asar "$pkgdir/usr/share/$pkgname/"
    
    # Copy icon
    install -Dm644 assests/transperent-logo.png "$pkgdir/usr/share/pixmaps/$pkgname.png"
    
    # Create wrapper script
    cat > "$pkgdir/usr/bin/$pkgname" << WRAPPER
#!/bin/sh
exec electron "/usr/share/$pkgname/app.asar" "\$@"
WRAPPER
    chmod +x "$pkgdir/usr/bin/$pkgname"
    
    # Install .desktop file
    cat > "$pkgdir/usr/share/applications/$pkgname.desktop" << DESKTOP
[Desktop Entry]
Name=Linux Wallpaper Engine
Comment=A modern desktop GUI for linux-wallpaperengine
Exec=linux-wallpaper-engine
Icon=linux-wallpaper-engine
Terminal=false
Type=Application
Categories=Utility;
DESKTOP
}
