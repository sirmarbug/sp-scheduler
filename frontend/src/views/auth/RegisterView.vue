<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { email as emailRule, minLength, required } from '@/validations'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''
  const success = await authStore.register(email.value, password.value)
  loading.value = false
  if (!success) {
    errorMessage.value = t('auth.register.error')
    return
  }
  router.push({ name: 'employees' })
}
</script>

<template>
  <div class="register-view">
    <q-card class="register-view__card">
      <q-card-section>
        <div class="text-h6">{{ t('auth.register.title') }}</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="handleSubmit">
          <q-input
            v-model="email"
            type="email"
            :label="t('auth.register.email')"
            :rules="[required, emailRule]"
          />
          <q-input
            v-model="password"
            type="password"
            :label="t('auth.register.password')"
            :rules="[required, minLength(8)]"
          />
          <div v-if="errorMessage" class="register-view__error">{{ errorMessage }}</div>
          <q-btn class="q-mt-md" type="submit" color="primary" :loading="loading" :label="t('auth.register.submit')" />
        </q-form>
      </q-card-section>
      <q-card-section>
        <router-link :to="{ name: 'login' }">{{ t('auth.register.hasAccount') }}</router-link>
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped lang="scss">
.register-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;

  &__card {
    width: 100%;
    max-width: 24rem;
  }

  &__error {
    color: $negative;
  }
}
</style>
