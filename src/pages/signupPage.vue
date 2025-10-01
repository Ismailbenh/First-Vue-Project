<template>
  <div class="signup-layout">
    <div class="signup-container">
      <div class="signup-form">
        <h2 class="signup-title">Create Account</h2>
        <form @submit.prevent="handleSignup">
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              v-model="email" 
              required 
              placeholder="Enter your email"
              class="signup-input"
            />
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password" 
              id="password" 
              v-model="password" 
              required 
              placeholder="Enter your password (min 6 characters)"
              class="signup-input"
              minlength="6"
            />
          </div>
          
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input 
              type="password" 
              id="confirmPassword" 
              v-model="confirmPassword" 
              required 
              placeholder="Confirm your password"
              class="signup-input"
            />
          </div>
          
          <button type="submit" class="signup-btn" :disabled="loading || !isFormValid">
            {{ loading ? 'Creating Account...' : 'Sign Up' }}
          </button>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          
          <div class="login-link">
            Already have an account? 
            <router-link to="/login" class="link">Login here</router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SignUp',
  data() {
    return {
      email: '',
      password: '',
      confirmPassword: '',
      loading: false,
      errorMessage: ''
    }
  },
  computed: {
    isFormValid() {
      return this.email && 
             this.password && 
             this.confirmPassword && 
             this.password === this.confirmPassword &&
             this.password.length >= 6;
    }
  },
  watch: {
    password() {
      this.validatePasswords();
    },
    confirmPassword() {
      this.validatePasswords();
    }
  },
  methods: {
    validatePasswords() {
      if (this.password && this.confirmPassword && this.password !== this.confirmPassword) {
        this.errorMessage = 'Passwords do not match';
      } else if (this.password && this.password.length < 6) {
        this.errorMessage = 'Password must be at least 6 characters long';
      } else {
        this.errorMessage = '';
      }
    },
    
    async handleSignup() {
      this.loading = true;
      this.errorMessage = '';

      // Final validation
      if (!this.isFormValid) {
        this.errorMessage = 'Please fill all fields correctly';
        this.loading = false;
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.email,
            password: this.password
            // No role field - server automatically assigns 'user'
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          // Store authentication info and redirect immediately
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('userEmail', this.email);
          localStorage.setItem('userRole', data.user.role); // Will always be 'user'
          localStorage.setItem('userId', data.user.id);
          
          console.log('Registration successful, redirecting to:', data.redirectUrl);
          
          // Use server's redirect URL (will be '/test' for new users)
          this.$router.push(data.redirectUrl);
          
        } else {
          this.errorMessage = data.message || 'Failed to create account';
        }
      } catch (error) {
        console.error('Signup error:', error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          this.errorMessage = 'Cannot connect to server. Please check if the server is running.';
        } else if (error.message.includes('JSON')) {
          this.errorMessage = 'Server response error. Please try again.';
        } else {
          this.errorMessage = 'Connection error. Please try again.';
        }
      }
      
      this.loading = false;
    }
  }
}
</script>

<style scoped>
.signup-layout {
  display: flex;
  min-height: 100vh;
  background: #1B3C53;
  align-items: center;
  justify-content: center;
}

.signup-container {
  width: 100%;
  max-width: 450px;
  padding: 24px;
}

.signup-form {
  background: #234a66;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.signup-title {
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

.signup-input {
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

.signup-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.signup-input::placeholder {
  color: rgba(249, 243, 239, 0.6);
}

.signup-btn {
  width: 100%;
  background: #28a745;
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

.signup-btn:hover:not(:disabled) {
  background: #218838;
}

.signup-btn:disabled {
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

.login-link {
  text-align: center;
  margin-top: 1.5rem;
  color: #F9F3EF;
  font-size: 0.9rem;
}

.link {
  color: #007bff;
  text-decoration: none;
  font-weight: 500;
}

.link:hover {
  color: #0056b3;
  text-decoration: underline;
}
</style>