;; Position-transform kernel corresponding to Vector3.applyMatrix4 in meshBuffers.ts.
;; f32 source/output, f64 arithmetic/matrices, including the perspective divide.
;; No SIMD, relaxed floating point, threads, allocator, or per-vertex JS calls.
(module
  (memory (export "memory") 1)
  (func $dot (param $m i32) (param $row i32) (param $x f64) (param $y f64) (param $z f64) (result f64)
    (f64.add
      (f64.add
        (f64.add
          (f64.mul (f64.load (i32.add (local.get $m) (local.get $row))) (local.get $x))
          (f64.mul (f64.load offset=32 (i32.add (local.get $m) (local.get $row))) (local.get $y)))
        (f64.mul (f64.load offset=64 (i32.add (local.get $m) (local.get $row))) (local.get $z)))
      (f64.load offset=96 (i32.add (local.get $m) (local.get $row)))))
  (func (export "transform")
    (param $source i32) (param $matrices i32) (param $output i32)
    (param $vertices i32) (param $instances i32)
    (local $i i32) (local $v i32) (local $p i32) (local $m i32) (local $o i32)
    (local $x f64) (local $y f64) (local $z f64) (local $w f64)
    (local.set $o (local.get $output))
    (block $done
      (loop $instance
        (br_if $done (i32.ge_u (local.get $i) (local.get $instances)))
        (local.set $m (i32.add (local.get $matrices) (i32.mul (local.get $i) (i32.const 128))))
        (local.set $v (i32.const 0))
        (block $next
          (loop $vertex
            (br_if $next (i32.ge_u (local.get $v) (local.get $vertices)))
            (local.set $p (i32.add (local.get $source) (i32.mul (local.get $v) (i32.const 12))))
            (local.set $x (f64.promote_f32 (f32.load (local.get $p))))
            (local.set $y (f64.promote_f32 (f32.load offset=4 (local.get $p))))
            (local.set $z (f64.promote_f32 (f32.load offset=8 (local.get $p))))
            (local.set $w (f64.div (f64.const 1) (call $dot (local.get $m) (i32.const 24) (local.get $x) (local.get $y) (local.get $z))))
            (f32.store (local.get $o) (f32.demote_f64 (f64.mul (call $dot (local.get $m) (i32.const 0) (local.get $x) (local.get $y) (local.get $z)) (local.get $w))))
            (f32.store offset=4 (local.get $o) (f32.demote_f64 (f64.mul (call $dot (local.get $m) (i32.const 8) (local.get $x) (local.get $y) (local.get $z)) (local.get $w))))
            (f32.store offset=8 (local.get $o) (f32.demote_f64 (f64.mul (call $dot (local.get $m) (i32.const 16) (local.get $x) (local.get $y) (local.get $z)) (local.get $w))))
            (local.set $o (i32.add (local.get $o) (i32.const 12)))
            (local.set $v (i32.add (local.get $v) (i32.const 1)))
            (br $vertex)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $instance)))))
