export default [
  {
    input: 'release/main.js',
    //input: 'src/main.js',
    output: {
      dir: '../output/',
      format: 'es',
      entryFileNames: '[name].js'
    },
    external: ['cs_script/point_script']
  }
];