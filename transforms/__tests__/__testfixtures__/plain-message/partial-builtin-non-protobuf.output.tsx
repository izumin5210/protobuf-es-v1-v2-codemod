interface Config {
  host: string;
  port: number;
}

function updateConfig(patch: Partial<Config>) {
  console.log(patch);
}
