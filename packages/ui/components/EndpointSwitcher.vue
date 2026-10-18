<script setup lang="ts">
import {
  IconCheck,
  IconPlus,
  IconServer,
  IconSettings,
} from '@tabler/icons-vue'
import { useConnect } from '~/composables/useConnect'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const endpointStore = useEndpointStore()
const { isOpen, close } = useEndpointSwitcher()
const { selectEndpoint, cancelSelection, endpointError, isSubmitting } =
  useConnect()
const modal = ref<{ open: () => void; close: (force?: boolean) => void }>()
const pendingId = ref('')

const errorMessage = computed(() => {
  if (endpointError.value === 'auth_error') return t('statusAuthError')
  if (endpointError.value === 'mixed_content') return t('mixedContentError')
  return endpointError.value ? t('endpointConnectError') : ''
})

watch(
  isOpen,
  (open) => {
    if (open) {
      modal.value?.open()
    } else {
      cancelSelection()
      pendingId.value = ''
      modal.value?.close(true)
    }
  },
  { flush: 'sync' },
)

watch(() => route.fullPath, close)
onBeforeUnmount(cancelSelection)

function dismiss() {
  close()
  return true
}

async function switchTo(id: string) {
  if (id === endpointStore.selectedEndpoint) {
    close()
    return
  }
  pendingId.value = id
  const switched = await selectEndpoint(id, {
    preserveRoute: route.path !== '/' && route.path !== '/setup',
  })
  if (switched) close()
}

async function manageEndpoints(add = false) {
  close()
  await router.push('/setup')
  if (add) {
    await nextTick()
    document.getElementById('url')?.scrollIntoView({ block: 'center' })
  }
}
</script>

<template>
  <Modal
    ref="modal"
    :title="t('switchEndpoint')"
    :before-close="dismiss"
    @close="close"
  >
    <template #icon><IconServer :size="22" /></template>
    <div class="flex flex-col gap-2">
      <button
        v-for="endpoint in endpointStore.endpointList"
        :key="endpoint.id"
        type="button"
        class="flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-base-200"
        :class="
          endpoint.id === endpointStore.selectedEndpoint
            ? 'border-primary/40 bg-primary/10'
            : 'border-base-content/10'
        "
        :aria-pressed="endpoint.id === endpointStore.selectedEndpoint"
        :aria-busy="isSubmitting && pendingId === endpoint.id"
        :disabled="isSubmitting && pendingId === endpoint.id"
        @click="switchTo(endpoint.id)"
      >
        <IconServer class="shrink-0 text-base-content/60" :size="20" />
        <span class="min-w-0 flex-1">
          <span
            v-if="endpoint.label"
            class="block truncate text-sm font-medium"
            >{{ endpoint.label }}</span
          >
          <span class="block text-xs break-all text-base-content/60">{{
            endpoint.url
          }}</span>
        </span>
        <span
          v-if="isSubmitting && pendingId === endpoint.id"
          role="status"
          class="flex shrink-0 items-center gap-2 text-xs"
        >
          <span class="loading loading-sm loading-spinner" />
          {{ t('statusConnecting') }}
        </span>
        <IconCheck
          v-else-if="endpoint.id === endpointStore.selectedEndpoint"
          class="shrink-0 text-primary"
          :size="20"
        />
      </button>
      <p
        v-if="endpointStore.endpointList.length === 0"
        class="py-4 text-center text-sm text-base-content/60"
      >
        {{ t('connectPrompt') }}
      </p>
      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-lg bg-error/10 p-3 text-sm text-error"
      >
        {{ errorMessage }}
      </p>
    </div>
    <template #actions>
      <button
        type="button"
        class="btn min-h-11 btn-ghost"
        @click="manageEndpoints()"
      >
        <IconSettings :size="18" />{{ t('manageEndpoints') }}
      </button>
      <button
        type="button"
        class="btn min-h-11 btn-primary"
        @click="manageEndpoints(true)"
      >
        <IconPlus :size="18" />{{ t('addEndpoint') }}
      </button>
    </template>
  </Modal>
</template>
