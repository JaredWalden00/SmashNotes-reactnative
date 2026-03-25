import SignInPage from "./auth/SignInPage";
import SignUpPage from "./auth/SignUpPage";
import ForgotPasswordPage from "./auth/ForgotPasswordPage";
import ResetPasswordPage from "./auth/ResetPasswordPage";
import EmailConfirmationPage from "./auth/EmailConfirmationPage";

export default function AuthScreen(props) {
  const {
    authMode,
    pendingConfirmation,
    isForgotPassword,
    isPasswordRecovery,
    onBackToSignIn,
  } = props;

  if (isPasswordRecovery) {
    return <ResetPasswordPage {...props} />;
  }

  if (isForgotPassword) {
    return <ForgotPasswordPage {...props} />;
  }

  if (pendingConfirmation) {
    return <EmailConfirmationPage authEmail={props.authEmail} onBackToSignIn={onBackToSignIn} />;
  }

  if (authMode === "signup") {
    return <SignUpPage {...props} />;
  }

  return <SignInPage {...props} />;
}
