import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center py-12">
      <SignIn />
      <p className="mt-4 text-base text-pop-black font-body text-center max-w-sm">
        Forgot your password? Enter your email and click Continue. You&apos;ll see a reset option on the next screen.
      </p>
    </div>
  );
}
