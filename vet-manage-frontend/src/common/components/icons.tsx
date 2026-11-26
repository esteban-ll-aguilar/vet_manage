import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

// Íconos de trazo para la interfaz; heredan el color del texto.
function Icon({ size = 18, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" /></Icon>
);

export const CalendarIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Icon>
);

export const PawIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6.5" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="17.5" cy="10" r="1.8" />
    <path d="M12 11.5c-2.8 0-5 3.2-5 5.3 0 1.6 1.2 2.7 2.7 2.7.9 0 1.5-.4 2.3-.4s1.4.4 2.3.4c1.5 0 2.7-1.1 2.7-2.7 0-2.1-2.2-5.3-5-5.3Z" />
  </Icon>
);

export const UsersIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.7 2.6 3 5.2" /></Icon>
);

export const BoxIcon = (props: IconProps) => (
  <Icon {...props}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></Icon>
);

export const PackageIcon = (props: IconProps) => (
  <Icon {...props}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M9 4v5l3-1.5L15 9V4" /></Icon>
);

export const FolderIcon = (props: IconProps) => (
  <Icon {...props}><path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z" /></Icon>
);

export const TagIcon = (props: IconProps) => (
  <Icon {...props}><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0l-8.7-7.9Z" /><circle cx="8" cy="8" r="1.4" /></Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>
);

export const ChevronsUpDownIcon = (props: IconProps) => (
  <Icon {...props}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></Icon>
);

export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></Icon>
);

export const MailIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></Icon>
);

export const IdCardIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16c.5-1.6 1.7-2.4 3-2.4s2.5.8 3 2.4M14.5 10h4M14.5 13.5h3" /></Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" /></Icon>
);

export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" /></Icon>
);

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.3 7 9 4.2-1.7 7-4.8 7-9V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15.5 10" /></Icon>
);

export const WalletIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="3.5" y="8" width="17" height="11.5" rx="2.5" /><path d="M16 13.8h2.5" /></Icon>
);

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}><path d="m5.5 12.5 4.2 4.2L18.5 7.5" /></Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
);

export const BellIcon = (props: IconProps) => (
  <Icon {...props}><path d="M6 9a6 6 0 0 1 12 0c0 3.6 1.5 5.5 1.5 5.5h-15S6 12.6 6 9Z" /><path d="M10 18a2 2 0 0 0 4 0" /></Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}><path d="M4 12h15M13 6l6 6-6 6" /></Icon>
);

export const ScaleIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3.5" y="4" width="17" height="16.5" rx="3" /><path d="M8 9.5a5.5 5.5 0 0 1 8 0l-2.2 2.2a2.5 2.5 0 0 0-3.6 0Z" /></Icon>
);

export const RulerIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 8v3M11 8v4M15 8v3M19 8v2" /></Icon>
);

export const PaletteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.9-.9 1.6-1.9-.3-1.1.4-2.1 1.5-2.1H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.6 16.7 3.5 12 3.5Z" />
    <circle cx="7.8" cy="11" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="14.8" cy="7.8" r="1" />
  </Icon>
);

export const GenderIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="10" cy="14" r="5" /><path d="M13.5 10.5 20 4M15 4h5v5" /></Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></Icon>
);

export const HeartIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" /></Icon>
);
