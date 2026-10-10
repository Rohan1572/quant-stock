const omittedDependencies = process.env.npm_config_omit?.split(",") ?? [];
const isProductionInstall =
  process.env.NODE_ENV === "production" ||
  process.env.npm_config_production === "true" ||
  omittedDependencies.includes("dev");

if (!isProductionInstall && !process.env.CI) {
  const { default: husky } = await import("husky");
  process.stdout.write(husky());
}
