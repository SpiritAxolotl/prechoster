{
  description = "prechoster";
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs, flake-utils }: flake-utils.lib.eachDefaultSystem (system: let

    pkgs = nixpkgs.legacyPackages.${system};

    compatibleSiteRev = "9ceeebd8";
    staticUrl = "https://cloudwithlightning.net/random/chostin/static.${compatibleSiteRev}/";

  in
  {

    packages.default = pkgs.buildNpmPackage {
      name = "prechoster";
      src = ./.;
      nativeBuildInputs = with pkgs; [ git ];
      npmDepsHash = "sha256-hw2QcOcKaTJ42TDoThHpvPRVQ8SgGPAQ6rz+UcQ9z8s=";

      installPhase = ''
        runHook preInstall
        mkdir $out
        cp -r dist/* $out
        runHook postInstall
      '';

      PRECHOSTER_STATIC = staticUrl;
      PRECHOSTER_GIT_COMMIT_HASH = if (self ? rev) then self.rev else "dirty";
    };

    devShells.default = pkgs.mkShell {
      buildInputs = with pkgs; [ nodejs ];

      PRECHOSTER_STATIC = staticUrl;
    };

  });
}
