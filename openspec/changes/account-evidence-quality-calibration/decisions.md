# Technical Decisions

- Duplicate Reviewer remains the canonical Account behavior; Cross Currency ports the contract without importing the private runtime.
- Website validation accepts conservative HTTP(S) URL/hostname forms and rejects phone-like, email-like, malformed, or hostless values.
- Phone validation accepts phone-like digit structure with at least seven digits and rejects too-short, email-like, URL-like, or malformed values.
- Invalid typed values are metadata-only evidence. They are not treated as blanks in audit output, but they behave as unavailable to the identity model.
- The Renaissance exception is limited to a valid unequal Website conflict with exact name, aligned address, and exact valid Phone; it does not make valid unequal Website conflicts generally harmless.
