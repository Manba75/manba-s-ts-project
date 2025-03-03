# 🚀 Delivery System Backend API

Welcome to the **Delivery System Backend API**! This API enables a seamless delivery process where **customers** can place orders and **delivery partners** can accept, verify, and deliver them efficiently. 📦

---

## 🌟 Features

✅ **Customer Registration & Login** 🔑  
✅ **Email Verification via OTP** 📩  
✅ **Forgot & Reset Password through Reset Link** 🔄  
✅ **Customers can place orders** (City → Vehicle Type → Pickup → Drop-off)  
✅ **Delivery partners register with vehicle details** 🚴‍♂️  
✅ **Real-time notifications via Socket.io** 🔔  
✅ **Delivery partner receives only available orders** 📬  
✅ **Order status updates & OTP verification** 🔢  
✅ **Final delivery confirmation** 🏁  

---

## 📌 API Workflow

1️⃣ **User (Delivery partner & customer) Registration & Authentication** 🔐  
   - Customers and delivery partners **register & log in**
   - Customers and delivery partners verify their email via **OTP**
   - Password reset via **reset link**

2️⃣ **Order Placement by Customer** 📦  
   - Customer selects **city & vehicle type**
   - Enters **pickup & drop location**
   - System generates an order ID & saves order details

3️⃣ **Order Notification & Acceptance** 🚴‍♂️  
   - Only **available delivery partners** receive the order request
   - A delivery partner accepts the order
   - Order status updates to **Accepted**
   - Customer receives a **notification** about order acceptance

4️⃣ **OTP Verification for Pickup** 🔑  
   - OTP is sent to the customer
   - Delivery partner verifies OTP at pickup location
   - If verified, order status updates to **Pickup**

5️⃣ **In-Transit (Moving to Drop Location)** 🚚  
   - Order status updates to **In-Progress**

6️⃣ **Final Delivery Confirmation** ✅  
   - Order is delivered successfully
   - Delivery partner updates status to **Delivered**
   - Delivery partner becomes available for new orders

---

## 🛠 Tech Stack

- **Node.js** (Backend) 🟢
- **Express.js** (Framework) 🚀
- **PostgreSQL** (Database) 🗄
- **TypeScript** (Strongly Typed Language) 📜
- **JWT** (Authentication) 🔐
- **Nodemailer** (For sending OTP & Reset Links) 📧
- **Socket.io** (Real-time Order Notifications) 📡

---


## 🔒 Authentication & Authorization

- **Customers & delivery partners** must **log in** to access functionalities
- Secure **JWT authentication** used for protected routes
- **Role-based access control** ensures the right permissions

---

## 📧 OTP & Notification Process

1. **Email OTP Verification:** Customers receive an OTP during registration to verify email 📩
2. **Forgot Password Reset:** Customers receive a reset link for password recovery 🔄
3. **Order OTP Verification:** Delivery partners must verify OTP at pickup location 🔑
4. **Real-time Notifications:** Order requests & updates are sent to users via **Socket.io** 🔔

---

## 🚀 Installation & Setup

### 1️⃣ Clone the Repository
```sh
git clone https://github.com/Manba75/manba-s-ts-project.git
cd manba-s-ts-project
```

### 2️⃣ Install Dependencies
```sh
npm install
```

### 3️⃣ Setup Environment Variables
Create a `.env` file and configure:  
```
PORT=5000
DATABASE_URL=your_postgresql_url
JWT_SECRET=your_secret_key
EMAIL_USER=your_email
EMAIL_PASS=your_password

```

### 4️⃣ Start the Server
```sh
npm run dev
```
Server runs at: `http://localhost:8000`

---

## 📌 Future Enhancements

- 📍 **Real-time order tracking** using GPS
- 📊 **Analytics dashboard** for admins
- 🌍 **Multi-location support** for scalability
- 📡 **notifications for order updates**

---

### 🎉 Happy Coding & Delivering! 🚀📦

