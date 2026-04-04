<script lang="ts">
  // Placeholder — will be filled in subsequent tasks
</script>

<div class="flex h-screen flex-col">
  <header class="flex h-12 items-center border-b px-4">
    <h1 class="text-lg font-semibold">Clawdex</h1>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 border-r p-4">
      <p class="text-sm text-muted-foreground">Sessions</p>
    </aside>

    <!-- Main chat area -->
    <main class="flex flex-1 flex-col">
      <div class="flex-1 overflow-y-auto p-4">
        <p class="text-muted-foreground">Start a conversation...</p>
      </div>

      <!-- Input composer -->
      <div class="border-t p-4">
        <div class="flex gap-2">
          <textarea
            class="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
            rows="1"
            placeholder="Type a message..."
          ></textarea>
          <button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Send
          </button>
        </div>
      </div>
    </main>
  </div>

  <!-- Status bar -->
  <footer class="flex h-8 items-center border-t px-4 text-xs text-muted-foreground">
    <span>Ready</span>
  </footer>
</div>
