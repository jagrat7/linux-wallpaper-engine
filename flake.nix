{
  description = "Linux Wallpaper Engine Flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { self, ... }@inputs:
    inputs.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import inputs.nixpkgs {
          inherit system;
          overlays = [ inputs.bun2nix.overlays.default ];
        };

        src = pkgs.nix-gitignore.gitignoreSourcePure [
          ./.gitignore
        ] ./.;

        # Specific Electron version (should match the project's package.json)
        # (for minor version bumps, flake lock needs to be bumped)
        electron = pkgs.electron_39; # v39.7.0

        package = pkgs.lib.importJSON ./package.json;
      in
      {
        devShells.default =
          pkgs.callPackage ./distro/nix/shell.nix
            { inherit package electron; };

        packages.default =
          pkgs.callPackage ./distro/nix/package.nix
            { inherit src package electron; };
      }
    );
}
