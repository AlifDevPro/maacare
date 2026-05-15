/** Bottom primary action + back behavior for signup flows. */
export type SignupWizardNav = {
  isFirstStep: boolean;
  onBackStep: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  isSubmit?: boolean;
  formId?: string;
  hideBottomBar?: boolean;
  /** For in-card morph transitions between wizard steps. */
  stepId?: string;
};
