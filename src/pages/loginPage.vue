<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups'

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const emailError = ref('');
const passwordError = ref('');
const router = useRouter();
const auth = useAuthStore();
const groupsStore = useGroupsStore()

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateEmail() {
  if (!email.value) {
    emailError.value = 'Email is required';
  } else if (!isValidEmail(email.value)) {
    emailError.value = 'Please enter a valid email address';
  } else {
    emailError.value = '';
  }
}

function validatePassword() {
  if (!password.value) {
    passwordError.value = 'Password is required';
  } else if (password.value.length < 3) { // Adjust minimum length as needed
    passwordError.value = 'Password is too short';
  } else {
    passwordError.value = '';
  }
}

function validateForm() {
  validateEmail();
  validatePassword();
  return !emailError.value && !passwordError.value;
}

async function handleLogin() {
  // Quick client-side validation
  if (!isFormValid.value) return;

  loading.value = true;
  errorMessage.value = '';

  try {
    const data = await auth.login(email.value, password.value);

    // If backend returned user object, persist minimal info
    if (data?.user) {
      const authData = {
        isAuthenticated: 'true',
        userEmail: data.user.email || email.value,
        userRole: data.user.role || '',
        userId: data.user.id || '',
        loginTime: Date.now()
      };
      Object.entries(authData).forEach(([k, v]) => localStorage.setItem(k, v));

      // clear local form
      email.value = '';
      password.value = '';

      router.push(data.redirectUrl || '/dashboard');
    } else {
      errorMessage.value = data?.message || 'Login failed. Please try again.';
    }
  } catch (err) {
    // Use message from store or thrown error
    errorMessage.value = auth.error || err.message || 'Login failed';
  } finally {
    loading.value = false;
  }
}

const isFormValid = computed(() => {
  return isValidEmail(email.value) && password.value && password.value.length >= 3;
});

onMounted(async () => {
  await groupsStore.fetchAll()
})
</script>
<template>
  <div class="login-layout">
    <div class="login-container">
      <div class="login-form">
        <h2 class="login-title">Login</h2>
        <form @submit.prevent="handleLogin" novalidate>
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              v-model.trim="email"
              required
              placeholder="Enter your email"
              class="login-input"
              :class="{ 'error': emailError }"
              @blur="validateEmail"
            />
            <div v-if="emailError" class="field-error">{{ emailError }}</div>
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              v-model="password"
              required
              placeholder="Enter your password"
              class="login-input"
              :class="{ 'error': passwordError }"
              @blur="validatePassword"
            />
            <div v-if="passwordError" class="field-error">{{ passwordError }}</div>
          </div>
          
          <button type="submit" class="login-btn" :disabled="loading || !isFormValid">
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </form>
        
        <div class="signup-link">
          Don't have an account? 
          <router-link to="/signup" class="link">Sign up here</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signup-link {
  text-align: center;
  margin-top: 1.5rem;
  color: #F9F3EF;
  font-size: 0.9rem;
}
/* Same styles as before */
.login-layout {
  display: flex;
  min-height: 100vh;
  background: #1B3C53;
  align-items: center;
  justify-content: center;
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}

.login-form {
  background: #234a66;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.login-title {
  color: #ffffff;
  font-size: 2rem;
  font-weight: bold;
  text-align: center;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: #F9F3EF;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
}

.login-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #3A6B85;
  border-radius: 4px;
  background: #1B3C53;
  color: #F9F3EF;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.login-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.login-input::placeholder {
  color: rgba(249, 243, 239, 0.6);
}
.link {
  color: #007bff;
  text-decoration: none;
  font-weight: 500;
}
.login-btn {
  width: 100%;
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 1rem;
}

.login-btn:hover:not(:disabled) {
  background: #0056b3;
}

.login-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.error-message {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid #dc3545;
  color: #dc3545;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
}
</style>