// Application Constants

// GitHub repository URL for releases
// Update this to match your GitHub repository
export const GITHUB_REPO_URL =
    "https://github.com/ho3einwave/better-dns-jumper";

// Release URL template
export const getReleaseUrl = (version: string) => {
    return `${GITHUB_REPO_URL}/releases/tag/v${version}`;
};
