if (process.env.NODE_ENV !== "production") {
  const { default: husky } = await import("husky");
  process.stdout.write(husky());
}
