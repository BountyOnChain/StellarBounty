/** @type {import('@lhci/cli').Config} */
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/"],
      startServerCommand: "npm run start --workspace=apps/frontend",
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 120000,
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
