<script lang="ts">
  import MessageList from "./MessageList.svelte";
  import InputComposer from "./InputComposer.svelte";
</script>

<main class="flex flex-1 flex-col overflow-hidden">
  <div class="flex-1 overflow-y-auto">
    <MessageList />
  </div>
  <InputComposer />
</main>
