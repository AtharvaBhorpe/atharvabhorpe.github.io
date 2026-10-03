import { defineConfig } from 'astro/config';

// GitHub user site: root deployment, no repository-name base prefix.
export default defineConfig({ site: 'https://atharvabhorpe.github.io', output: 'static', trailingSlash: 'always' });
