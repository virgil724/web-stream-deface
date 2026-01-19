// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  ssr: false,
  modules: ["@nuxtjs/tailwindcss", "shadcn-nuxt", "nuxt-gtag"],
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: './components/ui'
  },
  
  gtag: {
    id: 'G-S2ZRMNDVWC'
  },

  // HTTPS configuration for WebGPU support
  devServer: {
    https: {
      key: './localhost+2-key.pem',
      cert: './localhost+2.pem'
    }
  },

  // Configure headers and MIME types
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          // Enable these headers if you need SharedArrayBuffer for advanced WebGPU features
          // 'Cross-Origin-Embedder-Policy': 'require-corp',
          // 'Cross-Origin-Opener-Policy': 'same-origin',
          // Standard security headers
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        }
      },
      // Serve WASM files with correct MIME type
      '/**/*.wasm': {
        headers: {
          'Content-Type': 'application/wasm'
        }
      }
    }
  },

  // Configure Vite for proper WASM handling
  vite: {
    server: {
      fs: {
        allow: ['..']
      }
    },
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
      exclude: ['onnxruntime-web']
    }
  }
})