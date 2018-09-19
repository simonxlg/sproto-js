#!/bin/sh
lua lua make_sproto_file.lua ./proto/proto.c2s.sproto ./proto/struct.sproto c2s.sp
lua make_sproto_file.lua ./proto/proto.s2c.sproto ../proto/struct.sproto s2c.sp

cp *.sp ../