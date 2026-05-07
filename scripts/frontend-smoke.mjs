import { pathToFileURL } from 'node:url';

const flows = [
  {
    name: 'login-to-workspace-open',
    routes: ['/login', '/workspaces', '/workspace/[id]'],
    asserts: ['session cookie auth', 'workspace list visible', 'workspace shell opens'],
  },
  {
    name: 'send-chat-with-tool-call',
    routes: ['/chats', '/workspace/[id]'],
    asserts: ['chat composer accepts input', 'tool approval UI can render', 'SSE updates task status'],
  },
  {
    name: 'deploy-static-site',
    routes: ['/hosting'],
    asserts: ['create hosted service form', 'env validation', 'service lifecycle controls'],
  },
];

export function getFrontendSmokeFlows() {
  return flows;
}

export function runFrontendSmokeContract() {
  for (const flow of flows) {
    if (flow.routes.length === 0 || flow.asserts.length === 0) {
      throw new Error(`Smoke flow ${flow.name} must define routes and assertions`);
    }
  }

  console.log(`Frontend smoke contract covers ${flows.length} top flows.`);
  console.log('Run browser smoke with: pnpm smoke:web');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFrontendSmokeContract();
}
