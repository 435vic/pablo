{
  stdenvNoCC,
  deno,
  runCommand,
  makeWrapper,
  denoDepsHash ? "",
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
    outputHash = if denoDepsHash == "" then "sha256-gu0RSUpQPmwAsBiUID6zzcrLOl+qbTB7cUpVBRz9qTk=" else denoDepsHash;

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
in stdenvNoCC.mkDerivation {
  inherit pname version;

  nativeBuildInputs = [ makeWrapper ];
  dontUnpack = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin $out/lib/$pname
    cp -r ${deno-source}/* ${deps}/* $out/lib/$pname/
    makeWrapper ${deno}/bin/deno $out/bin/$pname \
      --add-flags "run" \
      --add-flags "--config=$out/lib/$pname/deno.json" \
      --add-flags "--cached-only" \
      --add-flags "--no-check" \
      --add-flags "--allow-all" \
      --add-flags "$out/lib/$pname/src/main.ts"
    runHook postInstall
  '';
}
