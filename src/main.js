// main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/router.js'
import { useAuthStore } from '@/stores/auth'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

try {
	const auth = useAuthStore()
	const isAuth = localStorage.getItem('isAuthenticated') === 'true'
	if (isAuth) {
		auth.setUser({
			email: localStorage.getItem('userEmail') || null,
			role: localStorage.getItem('userRole') || null,
			id: localStorage.getItem('userId') || null
		})
	}
} catch (e) {
}
app.use(router)

app.mount('#app')