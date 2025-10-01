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

<script>
export default {
  name: 'LoginComponent',
  data() {
    return {
      email: '',
      password: '',
      loading: false,
      errorMessage: '',
      emailError: '',
      passwordError: ''
    }
  },
  computed: {
    isFormValid() {
      return this.email && 
             this.password && 
             !this.emailError && 
             !this.passwordError &&
             this.isValidEmail(this.email);
    }
  },
  methods: {
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    validateEmail() {
      if (!this.email) {
        this.emailError = 'Email is required';
      } else if (!this.isValidEmail(this.email)) {
        this.emailError = 'Please enter a valid email address';
      } else {
        this.emailError = '';
      }
    },

    validatePassword() {
      if (!this.password) {
        this.passwordError = 'Password is required';
      } else if (this.password.length < 3) { // Adjust minimum length as needed
        this.passwordError = 'Password is too short';
      } else {
        this.passwordError = '';
      }
    },

    validateForm() {
      this.validateEmail();
      this.validatePassword();
      return !this.emailError && !this.passwordError;
    },

    async handleLogin() {
      // Validate form before submission
      if (!this.validateForm()) {
        return;
      }

      this.loading = true;
      this.errorMessage = '';

      try {
        console.log('Attempting login with:', { email: this.email });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.email,
            password: this.password
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        console.log('Response status:', response.status);

        if (!response.ok) {
          // Handle different HTTP status codes
          switch (response.status) {
            case 400:
              throw new Error('Invalid email or password format');
            case 401:
              throw new Error('Invalid email or password');
            case 403:
              throw new Error('Account is disabled or access forbidden');
            case 404:
              throw new Error('User not found');
            case 429:
              throw new Error('Too many login attempts. Please try again later');
            case 500:
              throw new Error('Server error. Please try again later');
            default:
              throw new Error(`Login failed with status: ${response.status}`);
          }
        }

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('Invalid server response');
        }

        console.log('Response data:', data);

        if (data.success) {
          // Store authentication info securely
          const authData = {
            isAuthenticated: 'true',
            userEmail: this.email,
            userRole: data.user.role,
            userId: data.user.id,
            loginTime: Date.now() // For session timeout if needed
          };

          // Store each piece of data
          Object.entries(authData).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
          
          console.log('Login successful, redirecting to:', data.redirectUrl);
          
          // Clear form
          this.email = '';
          this.password = '';
          
          // Navigate to the appropriate page
          this.$router.push(data.redirectUrl || '/dashboard');
          
        } else {
          this.errorMessage = data.message || 'Login failed. Please check your credentials';
        }

      } catch (error) {
        console.error('Login error:', error);
        
        if (error.name === 'AbortError') {
          this.errorMessage = 'Request timed out. Please check your connection and try again';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
          this.errorMessage = 'Cannot connect to server. Please check if the server is running';
        } else if (error.message.includes('JSON') || error.message.includes('server response')) {
          this.errorMessage = 'Server response error. Please try again';
        } else {
          this.errorMessage = error.message || 'Connection error. Please try again';
        }
      } finally {
        this.loading = false;
      }
    }
  },

  // Clear any errors when component is destroyed
  beforeUnmount() {
    this.errorMessage = '';
    this.emailError = '';
    this.passwordError = '';
  }
}
</script>


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