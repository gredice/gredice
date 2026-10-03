// System-font CSS for structural CI checks. Font fidelity needs a separate
// visual check; routine builds must not download Google Fonts.
module.exports = {
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap':
        "@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 100 900; src: local('Arial'); }",
};
