{
  stdenvNoCC,
  deno,
  runCommand,
  fetchzip,
  makeWrapper,
  stdenv,
  patchelf,
  lib,
  glibc
  # autoPatchelfHook
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
    outputHash = "sha256-JBwhuueUBODM1Mhiuv7wRPpBfTX5ePcPRs7erMc+CMU=";

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

  denort = stdenvNoCC.mkDerivation {
    name = "denort";
    src = fetchzip {
      url = "https://dl.deno.land/release/v2.5.6/denort-x86_64-unknown-linux-gnu.zip";
      hash = "sha256-5XHyA3iSfiA6gYBFfW4ITflKl6U8cEFRaJdxDkkcrP8=";
    };

    installPhase = ''
      cp $src/denort $out
    '';
  };
in stdenvNoCC.mkDerivation {
  inherit pname version;

  nativeBuildInputs = [ makeWrapper deno ];

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

  postInstall = ''
    wrapProgram $out/bin/$pname \
      --prefix LD_LIBRARY_PATH ${lib.makeLibraryPath[
        stdenv.cc.cc.lib
        glibc
      ]}
  '';

}
