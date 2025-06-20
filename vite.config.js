export default {
  build: {
    minify: true,      // Minify code for production (default)
    sourcemap: false,  // Do not generate source maps
    outDir: 'dist',    // Output directory for build
    emptyOutDir: true  // Clean output dir before build
  },
  publicDir: 'public', // Serve static assets from 'static' folder
  base: './',          // Use relative paths for assets
}