import { z } from "zod";
import { configDotenv } from "dotenv";

// load env
configDotenv({
  path: "../../.env",
});

// prepare schema
const orvalConfigSchema = z.object({
  OPENAPI_INPUT_SRC: z.url(),
});

// parse & validation
const env = orvalConfigSchema.parse(process.env);
const input = env.OPENAPI_INPUT_SRC;

export default {
  apiVue: {
    input,
    output: {
      target: "./clients/vue.ts",
      client: "vue-query",
      mode: "single",
      override: {
        mutator: {
          path: "./fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },

  apiCore: {
    input,
    output: {
      target: "./clients/core.ts",
      client: "fetch",
      mode: "single",
      override: {
        mutator: {
          path: "./fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },
};
