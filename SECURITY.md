# Security policy

FloodGuard handles location, contact, authentication, and emergency-response
data. Please report vulnerabilities privately so maintainers can protect users
before technical details become public.

## Supported version

Security fixes are applied to the latest commit on `main`. This project is a
live prototype and does not currently maintain older release branches.

## Report a vulnerability

Use GitHub's **Report a vulnerability** option on the repository's Security
tab. If private vulnerability reporting is unavailable, contact the repository
owner through the contact information on their GitHub profile and ask for a
private reporting channel. Do not open a public issue.

Include, when possible:

- the affected component and commit or version;
- reproducible steps or a minimal proof of concept;
- the impact, including what data or roles are exposed;
- any suggested mitigation; and
- whether the report may be credited publicly after a fix is released.

Maintainers will acknowledge a complete report within seven days, provide a
status update within fourteen days, and coordinate disclosure after a fix is
available. Timelines may change with severity and deployment constraints.

## Safe research boundaries

- Test only accounts and data you own or have explicit permission to use.
- Prefer a local installation; do not test the public demo with real personal
  data or emergency requests.
- Do not access, retain, or alter another person's data.
- Do not disrupt alerts, rescue workflows, infrastructure, or third-party
  services.
- Do not use social engineering, denial of service, automated scanning of the
  public deployment, or credential attacks.

Good-faith research that follows these boundaries is welcome. This repository
does not offer a paid bounty. Credit may be given in a published advisory when
requested and appropriate.

## Operational safety

FloodGuard is not an official warning service. Never create a real-looking
alert or rescue request for testing. Use the application's clearly labelled
demo mode and synthetic data. In an actual emergency in India, call **112** and
follow official authorities.
