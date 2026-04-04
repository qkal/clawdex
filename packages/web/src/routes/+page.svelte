<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import ChatArea from "$lib/components/ChatArea.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import { initConnection } from "$lib/stores/connection.js";
  import { onMount } from "svelte";

  onMount(() => {
    // Extract connection params from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    const host = window.location.hostname || "127.0.0.1";
    const port = parseInt(window.location.port || "3141", 10);

    if (token) {
      // Store token in sessionStorage for reconnects
      sessionStorage.setItem("clawdex-token", token);
      initConnection(host, port, token);
    } else {
      const stored = sessionStorage.getItem("clawdex-token");
      if (stored) {
        initConnection(host, port, stored);
      }
    }
  });
</script>

<div class="flex h-screen flex-col">
  <Header />
  <div class="flex flex-1 overflow-hidden">
    <Sidebar />
    <ChatArea />
  </div>
  <StatusBar />
</div>
