const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["C:/Projects/IMS/ims-scriptformer/open-source/desktop/mcp-server/dist/index.js"],
    env: {
      ...process.env,
      IMS_PROJECT_PATH: "C:/Users/Danil/Desktop/Work/IMS/крылья свободы",
    },
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);

  // 1. List tools
  const { tools } = await client.listTools();
  console.log("\n=== TOOLS ===");
  for (const t of tools) {
    console.log(`  ${t.name} — ${t.description.slice(0, 60)}...`);
  }

  // 2. List resources
  const { resources } = await client.listResources();
  console.log("\n=== RESOURCES ===");
  for (const r of resources) {
    console.log(`  ${r.name} [${r.uri}] — ${(r.description ?? '').slice(0, 60)}...`);
  }

  // 3. Read project info resource
  console.log("\n=== resource: project ===");
  const projectRes = await client.readResource({ uri: "ims://project" });
  console.log(projectRes.contents[0].text);

  // 4. Read workspaces resource
  console.log("\n=== resource: workspaces ===");
  const wsRes = await client.readResource({ uri: "ims://project/workspaces" });
  const wsData = JSON.parse(wsRes.contents[0].text);
  console.log("Total workspaces:", wsData.length);
  for (const w of wsData.slice(0, 5)) {
    console.log(`  ${w.title} | ${w.id}`);
  }

  // 5. Read assets resource
  console.log("\n=== resource: assets ===");
  const assetsRes = await client.readResource({ uri: "ims://project/assets" });
  const assetsData = JSON.parse(assetsRes.contents[0].text);
  console.log("Total assets:", assetsData.length);
  for (const a of assetsData.slice(0, 5)) {
    console.log(`  ${a.title} | ${a.id}`);
  }

  // 6. Read single asset resource
  if (assetsData.length > 0) {
    const firstId = assetsData[0].id;
    console.log(`\n=== resource: asset (${firstId}) ===`);
    const assetRes = await client.readResource({ uri: `ims://project/assets/${firstId}` });
    const a = JSON.parse(assetRes.contents[0].text);
    console.log(`  title: ${a.title}`);
    console.log(`  blocks: ${a.blocks?.length ?? 0}`);
    console.log(`  values keys: ${Object.keys(a.values ?? {}).join(", ")}`);
  }

  // 7. create_asset (tool)
  console.log("\n=== tool: create_asset ===");
  const created = await client.callTool({
    name: "create_asset",
    arguments: {
      title: "MCP Тест",
      workspaceId: "06271161-34e1-480b-8771-57bfe657acb5",
      parentIds: ["00000000-0000-0000-0000-000000000035"],
      values: { props: { имя: "Тестер", раса: "ТестовыйNPC" } },
    },
  });
  const cr = JSON.parse(created.content[0].text);
  console.log(JSON.stringify(cr, null, 2));

  // 8. change_asset (tool)
  if (cr.success) {
    console.log("\n=== tool: change_asset ===");
    const changed = await client.callTool({
      name: "change_asset",
      arguments: {
        id: cr.asset.id,
        values: { props: { имя: "Тестер 2", раса: "Обновлён" } },
      },
    });
    console.log(changed.content[0].text);
  }

  // 9. delete_asset (tool)
  if (cr.success) {
    console.log("\n=== tool: delete_asset ===");
    const deleted = await client.callTool({
      name: "delete_asset",
      arguments: { id: cr.asset.id },
    });
    console.log(deleted.content[0].text);
  }

  await client.close();
  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
