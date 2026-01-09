/**
 * ===========================================
 * COGNITO SERVICE
 * ===========================================
 * Handles AWS Cognito authentication in the frontend.
 * 
 * Uses amazon-cognito-identity-js SDK to:
 * - Register users
 * - Login users
 * - Verify email
 * - Manage tokens
 * ===========================================
 */

import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js'

// Get Cognito configuration from environment variables
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID
const COGNITO_APP_CLIENT_ID = import.meta.env.VITE_COGNITO_APP_CLIENT_ID

// Check if Cognito is configured
const isCognitoEnabled = COGNITO_USER_POOL_ID && COGNITO_APP_CLIENT_ID

if (!isCognitoEnabled) {
  console.warn('Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_APP_CLIENT_ID')
}

// Create Cognito User Pool instance
const poolData = isCognitoEnabled ? {
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_APP_CLIENT_ID
} : null

const userPool = isCognitoEnabled ? new CognitoUserPool(poolData) : null

/**
 * Register a new user
 * Uses mobile as username. Mobile verification is mandatory.
 */
export const registerUser = (mobile, password, name, email = null) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito is not configured'))
      return
    }

    const attributeList = [
      new CognitoUserAttribute({ Name: 'phone_number', Value: mobile }),
      new CognitoUserAttribute({ Name: 'name', Value: name })
    ]

    if (email) {
      attributeList.push(new CognitoUserAttribute({ Name: 'email', Value: email }))
    }

    // Use mobile as username
    userPool.signUp(mobile, password, attributeList, null, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Confirm user signup with verification code
 * Uses mobile as username
 */
export const confirmSignup = (mobile, confirmationCode) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito is not configured'))
      return
    }

    const userData = {
      Username: mobile,  // Use mobile as username
      Pool: userPool
    }

    const cognitoUser = new CognitoUser(userData)

    cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Resend confirmation code
 * Uses mobile as username
 */
export const resendConfirmationCode = (mobile) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito is not configured'))
      return
    }

    const userData = {
      Username: mobile,  // Use mobile as username
      Pool: userPool
    }

    const cognitoUser = new CognitoUser(userData)

    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Login user
 * Uses mobile number for authentication
 */
export const loginUser = (mobile, password) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito is not configured'))
      return
    }

    const authenticationDetails = new AuthenticationDetails({
      Username: mobile,  // Use mobile as username
      Password: password
    })

    const userData = {
      Username: mobile,  // Use mobile as username
      Pool: userPool
    }

    const cognitoUser = new CognitoUser(userData)

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        resolve({
          accessToken: result.getAccessToken().getJwtToken(),
          idToken: result.getIdToken().getJwtToken(),
          refreshToken: result.getRefreshToken().getToken(),
          expiresIn: result.getAccessToken().getExpiration()
        })
      },
      onFailure: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * Get current authenticated user
 */
export const getCurrentUser = () => {
  if (!userPool) {
    return null
  }
  return userPool.getCurrentUser()
}

/**
 * Get current user's session (tokens)
 */
export const getCurrentUserSession = () => {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCurrentUser()
    
    if (!cognitoUser) {
      reject(new Error('No user logged in'))
      return
    }

    cognitoUser.getSession((err, session) => {
      if (err) {
        reject(err)
        return
      }
      
      if (!session.isValid()) {
        reject(new Error('Session is not valid'))
        return
      }

      resolve({
        accessToken: session.getAccessToken().getJwtToken(),
        idToken: session.getIdToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken(),
        expiresIn: session.getAccessToken().getExpiration()
      })
    })
  })
}

/**
 * Get user attributes
 */
export const getUserAttributes = () => {
  return new Promise((resolve, reject) => {
    const cognitoUser = getCurrentUser()
    
    if (!cognitoUser) {
      reject(new Error('No user logged in'))
      return
    }

    cognitoUser.getUserAttributes((err, attributes) => {
      if (err) {
        reject(err)
        return
      }

      const userAttributes = {}
      attributes.forEach(attr => {
        userAttributes[attr.getName()] = attr.getValue()
      })

      resolve(userAttributes)
    })
  })
}

/**
 * Logout user
 */
export const logout = () => {
  const cognitoUser = getCurrentUser()
  if (cognitoUser) {
    cognitoUser.signOut()
  }
}

/**
 * Forgot password - initiate password reset
 * Uses mobile as username
 */
export const forgotPassword = (mobile) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito is not configured'))
      return
    }

    const userData = {
      Username: mobile,  // Use mobile as username
      Pool: userPool
    }

    const cognitoUser = new CognitoUser(userData)

    cognitoUser.forgotPassword({
      onSuccess: (result) => {
        resolve(result)
      },
      onFailure: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * Confirm forgot password - reset password with verification code
 * Uses mobile as username
 */
export const confirmForgotPassword = (mobile, verificationCode, newPassword) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito is not configured'))
      return
    }

    const userData = {
      Username: mobile,  // Use mobile as username
      Pool: userPool
    }

    const cognitoUser = new CognitoUser(userData)

    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => {
        resolve()
      },
      onFailure: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * Check if Cognito is enabled
 */
export const isCognitoConfigured = () => isCognitoEnabled

