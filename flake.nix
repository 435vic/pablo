{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ flake-parts, ... }:
  flake-parts.lib.mkFlake { inherit inputs; } (_: {
    systems = [
      "x86_64-linux"
      "aarch64-linux"
    ];

    perSystem = { pkgs, ... }: {
      devShells.default = pkgs.mkShellNoCC {
        packages = [
          pkgs.deno
          (pkgs.writers.writeFishBin "deploy" ''
             cd $PWD
             if not command -v u2c >/dev/null
             echo "Error: 'u2c' command not found in your PATH."
             echo "Please install it or add it to your PATH to use this script."
             exit 1
             end

             echo "Found 'u2c' executable. Proceeding..."

             set -l target_url "https://files.boredvico.dev/mc/pablo.tar.gz"
             set -l tmp_file (mktemp -t pablo_archive.XXXXXX.tar.gz)

             echo "Creating archive at temporary location: $tmp_file"

             git archive --format=tar.gz --output=$tmp_file HEAD

             if test $status -ne 0
               echo "Error: 'git archive' failed."
               rm -f $tmp_file # Clean up partial tmp file
               exit 1
             end

             echo "Archive created successfully."

             echo "Uploading to $target_url..."
             u2c $tmp_file $target_url

             if test $status -eq 0
               echo "Upload successful!"
             else
               echo "Error: 'u2c' upload failed with status $status."
             end

             echo "Cleaning up temporary file: $tmp_file"
             rm -f $tmp_file

             echo "Script finished." 
          '')
        ];
      };

      packages = import ./. { inherit pkgs; };
    };
  });
}

