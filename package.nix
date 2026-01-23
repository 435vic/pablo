{
  stdenvNoCC,
  deno,
  runCommand,
  fetchzip,
  autoPatchelfHook,
  libgcc,
  denoDepsHash ? "",
  stdenv
}: let
  pname = "pablo";
  version = "v0.69.0";

  deno-source = runCommand "${pname}-source" { src = ./.; } ''
    mkdir -p $out
    cp -r $src/src $out
    cp $src/deno.json $out
    cp $src/deno.lock $out
  '';

  deps = stdenvNoCC.mkDerivation {
    name = "${pname}-deno-deps";
    src = deno-source;

    nativeBuildInputs = [ deno ];
    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = if denoDepsHash == "" then "sha256-BaBnOl7oPvJfbVo1YgGB8EYGzWJ/wfCgO180EOuuFSg=" else denoDepsHash;

    DENO_DIR=".deno";

    buildPhase = ''
      deno install --vendor --frozen
    '';

    installPhase = "
      mkdir -p $out
      cp -r ./vendor $out/
      cp -r ./node_modules $out/
    ";

    dontFixup = true;
  };

  denort = stdenv.mkDerivation {
    name = "denort";

    nativeBuildInputs = [ autoPatchelfHook libgcc ];

    src = fetchzip {
      url = "https://dl.deno.land/release/v2.6.4/denort-x86_64-unknown-linux-gnu.zip";
      hash = "sha256-EaQvGDl3HHeg9KUf6FoT86H9PlK2kgVz7Jl2/yPwiHw=";
    };

    installPhase = ''
      cp $src/denort $out
    '';

    dontFixup = false;
  };
in stdenvNoCC.mkDerivation {
  inherit pname version;

  nativeBuildInputs = [ deno ];

  unpackPhase = ''
    cp -r ${deno-source}/* .
    cp -r ${deps}/* .
  '';

  DENORT_BIN = denort;

  buildPhase = ''
    runHook preBuild
    deno compile \
      --output "$pname" \
      --cached-only \
      --no-check \
      --allow-all \
      "./src/main.ts"
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin
    cp "$pname" $out/bin
    runHook postInstall
  '';

  dontFixup = true;

  # fixupPhase = ''
  #   patchelf \
  #     --set-interpreter $(cat $NIX_CC/nix-support/dynamic-linker) \
  #     $out/bin/$pname
  # '';
}
