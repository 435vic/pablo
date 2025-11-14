{
  pkgs ? import <nixpkgs>,
}: rec {
  default = pkgs.callPackage ./package.nix {};
  pablo = default;
}

