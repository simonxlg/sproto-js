//=================================================================
// Sproto
// Author Simon_xlg 285909195@qq.com
//=================================================================
var Sproto = {
    new: function(data) {
        function hexArr64ToNum(arr){
            var herArr = arr.slice(0,8);
            return hexArrToNum(herArr);
        }
		
        function numToHexArr64(num){
            var herArr = numToHexArr(num);
            var arr = [];
            for(i = 0; i<(8 - herArr.length);i++){
                arr[i] = 0;
            }
            return arr.concat(herArr);
        }

        function numToHexArr(num){
            var num_16 = num.toString(16)
            var arr=[];
            for(var i = 0;i<num_16.length;i += 2){
            //for(var i = num_16.length;i>1;i -= 2){
                arr[i>>1] = ("0x"+num_16.charAt(i) + num_16.charAt(i+1))
            }
            return arr;
        }

        function hexArrToNum(arr){
            var str = "0x";
            for(var i = arr.length-1;i>-1;i--){
                var c = arr[i].toString(16)
                c = (c.length == 1?c="0"+c:c)
                str += c;
            }
            return Number(str);
        }

        function array_concat(a1, a2) {
            var b = new Array();
            for (var i = 0; i < a1.sz; i++) {
                b[i] = a1.buf[i];
            }
            for (var j = a1.sz; j < a1.sz + a2.sz; j++) {
                b[j] = a2.buf[j - a1.sz];
            }
            return {buf:b, sz:a1.sz + a2.sz};
        }
		
        function toword(stream) {
            return v = (stream[0] & 0xff) | (stream[1] & 0xff) << 8;
        }
		
        function todword(stream) {
            return (stream[0] & 0xff) | (stream[1] & 0xff) << 8 | (stream[2] & 0xff) << 16 | (stream[3] & 0xff) << 24;
        }
		
        function count_array(stream) {
            var length = todword(stream);
            var n = 0;
            stream = stream.slice(4);
            while (length > 0) {
                var nsz;
                if (length < 4) {
                    return -1;
                }
                nsz = todword(stream);
                nsz += 4;
                if (nsz > length) {
                    return -1;
                }
                ++n;
                stream = stream.slice(nsz);
                length -= nsz;
            }
            return n;
        }
		
        function struct_field(stream, sz) {
            var field, fn, header, i;
            if (sz < 4) {
                return -1;
            }
            fn = toword(stream);
            header = 2 + 2 * fn;
            if (sz < header) {
                return -1;
            }
            field = stream.slice(2);
            sz -= header;
            stream = stream.slice(header);
            for (i = 0; i < fn; i++) {
                var value = toword(field.slice(i * 2 + 2));
                var dsz;
                if (value != 0) {
                    continue;
                }
                if (sz < 4) {
                    return -1;
                }
                dsz = todword(stream);
                if (sz < 4 + dsz) {
                    return -1;
                }
                stream = stream.slice(4 + dsz);
                sz -= 4 + dsz;
            }
            return fn;
        }
		
        function import_string(stream) {
            var str = "";
            arr = stream.slice(4, 4 + todword(stream));
            for (var i = 0; i < arr.length; i++) {
                str += String.fromCharCode(arr[i]);
            }
            return str;
        }
		
        function import_field(f, stream) {
            var sz, result, fn, i;
            var array = 0;
            var tag = -1;
            f.tag = -1;
            f.type = -1;
            f.name = null;
            f.st = null;

            sz = todword(stream);
            stream = stream.slice(4);
            result = stream.slice(sz);
            fn = struct_field(stream, sz);
            if (fn < 0) {
                return null;
            }
            stream = stream.slice(2);
            for (i = 0; i < fn; i++) {
                var value;
                ++tag;
                value = toword(stream.slice(2 * i));
                if ((value & 1) != 0) {
                    tag += value >> 1;
                    continue;
                }
                if (tag == 0) {
                    if (value != 0) {
                        return null;
                    }
                    f.name = import_string(stream.slice(fn * 2));
                    continue;
                }
                if (value == 0) {
                    return null;
                }
                value = (value >> 1) - 1;
                switch (tag) {
                case 1:
                    if (value >= 3) {
                        return null;
                    }
                    f.type = value;
                    break;
                case 2:
                    if (value >= sproto.type_n) {
                        return null;
                    }
                    if (f.type >= 0) {
                        return null;
                    }
                    f.type = 3;
                    f.st = value;
                    break;
                case 3:
                    f.tag = value;
                    break;
                case 4:
                    if (value != 0) {
                        array = 0x80;
                    }
                    break;
                default:
                    return null;
                }
            }
            if (f.tag < 0 || f.type < 0 || f.name == null) {
                return null;
            }
            f.type |= array;
            return result;
        }
		
        function import_type(t, stream) {
            var result, i, fn, n, maxn, last;
            var sz = todword(stream);
            stream = stream.slice(4);
            result = stream.slice(sz);
            fn = struct_field(stream, sz);
            if (fn <= 0 || fn > 2) {
                return null;
            }
            for (i = 0; i < fn * 2; i += 2) {
                var v = toword(stream.slice(2 + i));
                if (v != 0) {
                    return null;
                }
            }
            stream = stream.slice(2 + fn * 2);
            t.name = import_string(stream);
            if (fn == 1) {
                return result;
            }
            stream = stream.slice(todword(stream) + 4);
            n = count_array(stream);
            if (n < 0) {
                return null;
            }
            stream = stream.slice(4);
            maxn = n;
            last = -1;
            t.n = n;
            t.f = new Array();
            for (i = 0; i < n; i++) {
                var tag;
                t.f[i] = new Object();
                var f = t.f[i];
                stream = import_field(f, stream);
                if (stream == null) {
                    return null;
                }
                tag = f.tag;
                if (tag < last) {
                    return null;
                }
                if (tag > last + 1) {
                    ++maxn;
                }
                last = tag;
            }
            t.maxn = maxn;
            t.base = t.f[0].tag;
            n = t.f[n - 1].tag - t.base + 1;
            if (n != t.n) {
                t.base = -1;
            }
            return result;
        }
		
        function import_protocol(p, stream) {
            var result, sz, fn, i, tag;
            sz = todword(stream);
            stream = stream.slice(4);
            result = stream.slice(sz);
            fn = struct_field(stream, sz);
            stream = stream.slice(2);
            p.name = null;
            p.tag = -1;
            p.p = new Array();
            p.p[0] = null;
            p.p[1] = null;
            tag = 0;
            for (i = 0; i < fn; i++, tag++) {
                var value = toword(stream.slice(2 * i));
                if (value & 1) {
                    tag += (value - 1) >> 1;
                    continue;
                }
                value = (value >> 1) - 1;
                switch (i) {
                case 0:
                    if (value != -1) {
                        return null;
                    }
                    p.name = import_string(stream.slice(2 * fn));
                    break;
                case 1:
                    if (value < 0) {
                        return null;
                    }
                    p.tag = value;
                    break;
                case 2:
                    if (value < 0 || value >= sproto.type_n) {
                        return null;
                    }
                    p.p[0] = sproto.type[value];
                    break;
                case 3:
                    if (value < 0 || value >= sproto.type_n) {
                        return null;
                    }
                    p.p[1] = sproto.type[value];
                    break;
                default:
                    return null;
                }
            }
            if (p.name == null || p.tag < 0) {
                return null;
            }
            return result;
        }
		
		var sproto = {};
        var result = {};
        var __session = [];
        var __buf;
		
        function create(stream, sz) {
            var conetnt, typedata, protocoldata;
            var fn = struct_field(stream, sz);
            var i;
            if (fn < 0) {
                return null;
            }
            stream = stream.slice(2);
            content = stream.slice(fn * 2);

            for (i = 0; i < fn; i++) {
                var value = toword(stream.slice(i * 2));
                var n;
                if (value != 0) {
                    return null;
                }
                n = count_array(content);
                if (n < 0) {
                    return null;
                }
                if (i == 0) {
                    typedata = content.slice(4);
                    sproto.type_n = n;
                    sproto.type = new Array();
                } else {
                    protocoldata = content.slice(4);
                    sproto.protocol_n = n;
                    sproto.proto = new Array();
                }
                content = content.slice(todword(content) + 4);
            }
            for (i = 0; i < sproto.type_n; i++) {
                sproto.type[i] = new Object();
                typedata = import_type(sproto.type[i], typedata);
                if (typedata == null) {
                    return null;
                }
            }
            for (i = 0; i < sproto.protocol_n; i++) {
                sproto.proto[i] = new Object();
                protocoldata = import_protocol(sproto.proto[i], protocoldata);
                if (protocoldata == null) {
                    return null;
                }
            }
            return sproto;
        }

        function decode_array_object(cb, args, stream, sz) {
            var hsz;
            var index = 1;
            while (sz > 0) {
                if (sz < 4) {
                    return -1;
                }
                hsz = todword(stream);
                stream = stream.slice(4);
                sz -= 4;
                if (hsz > sz) {
                    return -1;
                }
                args.index = index;
                args.value = stream;
                args.length = hsz;
                if (cb(args) != 0) {
                    return -1;
                }
                sz -= hsz;
                stream = stream.slice(hsz);
                ++index;
            }
            return 0;
        }
        function decode_array(cb, args, stream) {
            var sz = todword(stream);
            var type = args.type;
            var i;
            stream = stream.slice(4);
            switch (type) {
            case 0: {
                var len;
                if (sz < 1) {
                    return -1;
                }
                len = stream[0];
                stream = stream.slice(1);
                --sz;
                if (len == 4) {
                    if (sz % 4 != 0) {
                        return -1;
                    }
                    for (i = 0; i < sz >> 2; i++) {
                        var value = todword(stream.slice(i * 4));
                        args.index = i + 1;
                        args.value = value;
                        args.length = 4;
                        cb(args);
                    }
                } else {
                    if (sz % 8 != 0) {
                        return -1;
                    }
                    for (i = 0; i < sz >> 3; i++) {
                        var value = hexArr64ToNum(stream.slice(i >>> 3 ));
                        args.index = i + 1;
                        args.value = value;
                        args.length = 8;
                        cb(args);
                    }
                }
                break;
            }
            case 1:
                for (i = 0; i < sz; i++) {
                    var value = stream[i];
                    args.index = i + 1;
                    args.value = value;
                    args.length = 8;
                    cb(args);
                }
                break;
            case 2:
            case 3:
                return decode_array_object(cb, args, stream, sz);
            default:
                return -1;
            }
            return 0;
        }
        function findtag(st, tag) {
            var begin, end;
            if (st.base >= 0) {
                tag -= st.base;
                if (tag < 0 || tag >= st.n) {
                    return null;
                }
                return st.f[tag];
            }
            begin = 0;
            end = st.n;
            while (begin < end) {
                var mid = ((begin + end) >> 1);
                var f = st.f[mid];
                var t = f.tag;
                if (t == tag) {
                    return f;
                }
                if (tag > t) {
                    begin = mid + 1;
                } else {
                    end = mid;
                }
            }
            return null;
        }
        function sproto_type(typename) {
            var i;
            for (i = 0; i < sproto.type_n; i++) {
                if (typename == sproto.type[i].name) {
                    return sproto.type[i];
                }
            }
            return null;
        }
        function sproto_protoquery_name(name,sproto) {
            for (var i = 0; i < sproto.protocol_n; i++) {
                if (sproto.proto[i].name == name) {
                    return sproto.proto[i];
                }
            }
            return null;
        }

        function query_proto(proto) {
            var begin, end, p;
            p = null;
            begin = 0;
            end = sproto.protocol_n;
            while (begin < end) {
                var mid = (begin + end) >> 1;
                var t = sproto.proto[mid].tag;
                if (t == proto) {
                    p = sproto.proto[mid];
                }
                if (proto > t) {
                    begin = mid + 1;
                } else {
                    end = mid;
                }
            }
            return p;
        }

        function sproto_protoname(proto) {
            var p = query_proto(proto);
            if (p) {
                return p.name;
            }
            return null;
        }

        function sproto_protoquery(proto, what) {
            if (what < 0 || what > 1) {
                return null;
            }
            p = query_proto(proto);
            if (p != null) {
                return p.p[what];
            }
            return null;
        }
		
        function sproto_decode(st, data, size, cb, ud) {
            var args = new Object();
            var total = size;
            var stream, datastream, fn, i, tag;
            if (size < 2) {
                console.log("return -1;");
                return -1;
            }
            stream = data.slice(0);
            fn = toword(stream);
            stream = stream.slice(2);
            size -= 2;
            if (size < fn * 2) {
                console.log("return -1;");
                return -1;
            }
            datastream = stream.slice(fn * 2);
            size -= fn * 2;
            args.ud = ud;

            tag = -1;
            for (i = 0; i < fn; i++) {

                var currentdata;
                var f;
                var value = parseInt(toword(stream.slice(i * 2)));
                ++tag;
                if ((value & 1) != 0) {
                    tag += (value >> 1);
                    continue;
                }
                value = parseInt((value >> 1) - 1);
                currentdata = datastream.slice(0);
                if (value < 0) {
                    var sz;
                    if (size < 4) {
                        console.log("return -1;");
                        return -1;
                    }
                    sz = todword(datastream);
                    if (size < sz + 4) {
                        console.log("return -1;");
                        return -1;
                    }
                    datastream = datastream.slice(sz + 4);
                    size -= sz + 4;
                }
                f = findtag(st, tag);
                if (f == null) {
                    continue;
                }
                args.tagname = f.name;
                args.tagid = f.tag;
                args.type = f.type & ~0x80;
                //console.log(args);
                if (f.st != null) {
                    args.subtype = sproto.type[f.st];
                } else {
                    args.subtype = null;
                }
                args.index = 0;
                if (value < 0) {
                    if ((f.type & 0x80) != 0) {
                        if (decode_array(cb, args, currentdata) != 0) {
                            console.log("return -1;");
                            return -1;
                        }
                    } else {
                        switch (f.type) {
                        case 0: {
                            var sz = todword(currentdata);
                            if (sz == 4) {
                                var v = parseInt(todword(currentdata.slice(4)));
                                args.value = v;
                                args.length = 4;
                                cb(args);
                            }
                            else if(sz == 8){
                                //var v = todword(currentdata.slice(8));
                                args.value = hexArr64ToNum(currentdata.slice(4));
                                args.length = 8;
                                cb(args);
                            }
                            else {
                                return -1;
                            }
                            break;
                        }
                        case 2:
                        case 3: {
                            var sz = todword(currentdata);
                            args.value = currentdata.slice(4);
                            args.length = sz;
                            if (cb(args) != 0) {
                                console.log("return -1;");
                                return -1;
                            }
                            break;
                        }
                        default:
                            console.log("return -1;");
                            return -1;
                        }
                    }
                } else if (f.type != 0 && f.type != 1) {
                    return -1;
                } else {
                    var v = value;
                    args.value = v;
                    args.length = 8;
                    cb(args);
                }
            }
            return total - size;
        }
        function decode(args) {

            var self = args.ud;
            var value;
            if (self.deep >= 64) {
                console.log("The table is too deep");
            }
            if (args.index > 0) {
                if (args.tagname != self.array_tag) {
                    self.array_tag = args.tagname;
                    self.result[args.tagname] = new Array();
                }
            }
            switch (args.type) {
            case 0:
            case 1:
                value = args.value;
                break;
            case 2:
                value = ""
                for (var i = 0; i < args.length; i++) {
                    value += String.fromCharCode(args.value[i]);
                }
                break;
            case 3:
                var sub, r;
                sub = new Object();
                sub.deep = self.deep + 1;
                sub.array_tag = null;
                sub.result = new Object();
                r = sproto_decode(args.subtype, args.value, args.length, decode, sub);
                if (r < 0 || r != args.length) {
                    return r;
                }
                value = sub.result;
                break;
            default:
                console.log("invalid type");
            }
            if (args.index > 0) {
                self.result[args.tagname][args.index-1] = value;
            } else {
                self.result[args.tagname] = value;
            }
            return 0;
        }

        function sproto_encode(type, buffer_idx, cb, ud) {
            var args = new Object();
            var header_idx = buffer_idx;
            var data_idx = buffer_idx;
            var st = type;
            var header_sz = 2 + st.maxn * 2;
            var i, index, lasttag, datasz;


            function fill_size(data_idx, sz) {
                __buf[data_idx] = sz & 0xff;
                __buf[data_idx + 1] = (sz >> 8) & 0xff;
                __buf[data_idx + 2] = (sz >> 16) & 0xff;
                __buf[data_idx + 3] = (sz >> 24) & 0xff;
                return sz + 4;
            }
            function encode_integer(v, data_idx) {
                __buf[data_idx + 4] = v & 0xff;
                __buf[data_idx + 5] = (v >>> 8) & 0xff;
                __buf[data_idx + 6] = (v >>> 16) & 0xff;
                __buf[data_idx + 7] = (v >>> 24) & 0xff;
                return fill_size(data_idx, 4);
            }
            function encode_int64(v, data_idx) {
                var arr = numToHexArr64(v);
                __buf[data_idx + 4] = arr[0] & 0xff;
                __buf[data_idx + 5] = arr[1] & 0xff;
                __buf[data_idx + 6] = arr[2] & 0xff;
                __buf[data_idx + 7] = arr[3] & 0xff;
                __buf[data_idx + 8] = arr[4] & 0xff;
                __buf[data_idx + 9] = arr[5] & 0xff;
                __buf[data_idx + 10] = arr[6] & 0xff;
                __buf[data_idx + 11] = arr[7] & 0xff;
                return fill_size(data_idx, 8);
            }
            function encode_object(cb, args, data_idx) {
                var sz;
                args.value = data_idx + 4;
                sz = cb(args);
                if (sz <= 0) {
                    return sz;
                }
                if (args.type == 2) {
                    --sz;
                }
                return fill_size(data_idx, sz);
            }
            function encode_integer_array(cb, args, buffer_idx) {
                var header_idx = buffer_idx;
                var intlen;
                var index;
                buffer_idx++;
                intlen = 4;
                index = 1;
                for (;;) {
                    var sz;
                    args.value = null;
                    args.length = 4;
                    args.index = index;
                    sz = cb(args);
                    if (sz < 0) {
                        return null;
                    }
                    if (sz == 0) {
                        break;
                    }
                    if (sz == 4) {
                        var v = args.value;
                        __buf[buffer_idx] = v & 0xff;
                        __buf[buffer_idx + 1] = (v >> 8) & 0xff;
                        __buf[buffer_idx + 2] = (v >> 16) & 0xff;
                        __buf[buffer_idx + 3] = (v >> 24) & 0xff;
                    } else {
                        intlen = 8;
                        var arr = numToHexArr64(args.value);
                        __buf[buffer_idx + 0] = arr[0] & 0xff;
                        __buf[buffer_idx + 1] = arr[1] & 0xff;
                        __buf[buffer_idx + 2] = arr[2] & 0xff;
                        __buf[buffer_idx + 3] = arr[3] & 0xff;
                        __buf[buffer_idx + 4] = arr[4] & 0xff;
                        __buf[buffer_idx + 5] = arr[5] & 0xff;
                        __buf[buffer_idx + 6] = arr[6] & 0xff;
                        __buf[buffer_idx + 7] = arr[7] & 0xff;
                    }
                    buffer_idx += intlen;
                    index++;
                }
                if (buffer_idx == header_idx + 1) {
                    return header_idx;
                }
                __buf[header_idx] = intlen & 0xff;
                return buffer_idx;
            }
            function encode_array(cb, args, data_idx) {
                var buffer_idx;
                var sz;
                buffer_idx = data_idx + 4;
                switch (args.type) {
                case 0:
                    buffer_idx = encode_integer_array(cb, args, buffer_idx);
                    if (buffer_idx == null) {
                        return -1;
                    }
                    break;
                case 1:
                    args.index = 1;
                    for (;;) {
                        var v = 0;
                        args.value = v;
                        args.length = 4;
                        sz = cb(args);
                        if (sz < 0) {
                            return -1;
                        }
                        if (sz == 0) {
                            break;
                        }
                        __buf[buffer_idx] = v ? 1: 0;
                        buffer_idx += 1;
                        ++args.index;
                    }
                    break;
                default:
                    args.index = 1;
                    for (;;) {
                        args.value = buffer_idx + 4;
                        sz = cb(args);
                        if (sz == 0) {
                            break;
                        }
                        if (sz < 0) {
                            return -1;
                        }
                        if (args.type == 2) {
                            --sz;
                        }
                        fill_size(buffer_idx, sz);
                        buffer_idx += 4 + sz;
                        ++args.index;
                    }
                    break;
                }
                sz = buffer_idx - (data_idx + 4);
                if (sz == 0) {
                    return 0;
                }
                return fill_size(data_idx, sz);
            }

            args.ud = ud;
            data_idx = header_idx + header_sz;
            index = 0;
            lasttag = -1;
            for (i = 0; i < st.n; i++) {
                var f = st.f[i];
                var type = f.type;
                var value = 0;
                var sz = -1;
                args.tagname = f.name;
                args.tagid = f.tag;
                if (f.st != null) {
                    args.subtype = sproto.type[f.st];
                } else {
                    args.subtype = null;
                }
                if (type & 0x80) {
                    args.type = type & ~0x80;
                    sz = encode_array(cb, args, data_idx);
                } else {
                    args.type = type;
                    args.index = 0;
                    switch(type) {
                    case 0:
                    case 1:
                        args.value = 0;
                        args.length = 4;
                        sz = cb(args);
                        if (sz < 0) {
                            return -1;
                        }
                        if (sz == 0) {
                            continue;
                        }
                        if (sz == 4) {
                            if (args.value < 0x7fff) {
                                value = (args.value + 1) * 2;
                                sz = 2;
                            } else {
                                sz = encode_integer(args.value, data_idx);
                            }
                        }else if (sz == 8) {
                            sz = encode_int64(args.value, data_idx);
                        }else {
                            return -1;
                        }
                        break;
                    case 3:
                    case 2:
                        sz = encode_object(cb, args, data_idx);
                        break;
                    }
                }
                if (sz < 0) {
                    return -1;
                }
                if (sz > 0) {
                    var record_idx, tag;
                    if (value == 0) {
                        data_idx += sz;
                    }
                    record_idx = header_idx + 2 + 2 * index;
                    tag = f.tag - lasttag - 1;
                    if (tag > 0) {
                        tag = (tag - 1) * 2 + 1;
                        if (tag > 0xffff) {
                            return -1;
                        }
                        __buf[record_idx] = tag & 0xff;
                        __buf[record_idx + 1] = (tag >> 8) & 0xff;
                        ++index;
                        record_idx += 2;
                    }
                    ++index;
                    __buf[record_idx] = value & 0xff;
                    __buf[record_idx + 1] = (value >> 8) & 0xff;
                    lasttag = f.tag;
                }
            }
            __buf[header_idx] = index & 0xff;
            __buf[header_idx + 1] = (index >> 8) & 0xff;
            datasz = data_idx - (header_idx + header_sz);
            data_idx = header_idx + header_sz;
            if (index != st.maxn) {
                var v = __buf.slice(data_idx, data_idx + datasz);
                for (var s = 0; s < v.length; s++) {
                    __buf[header_idx + 2 + index * 2 + s] = v[s];
                }
            }
            return 2 + index * 2 + datasz;
        }
        
        function encode(args) {
            var self = args.ud;
            if (self.deep >= 64) {
                console.log("table is too deep");
                return -1;
            }
            if (self.indata[args.tagname] == null) {
                return 0;
            }
            if (args.index > 0) {
                if (args.tagname != self.array_tag) {
                    self.array_tag = args.tagname;
                }
                if (self.indata[args.tagname][args.index-1] == null) {
                    return 0;
                }
            }
            switch (args.type) {
            case 0:
            case 1:
                if (args.index == 0) {
                    args.value = self.indata[args.tagname];
                } else {
                    args.value = self.indata[args.tagname][args.index];
                }
                return args.value > 0xffffffff?8:4;
            case 2:
                var str;
                if (args.index == 0) {
                    str = self.indata[args.tagname];
                } else {
                    str = self.indata[args.tagname][args.index];
                }
                for (var i = 0; i < str.length; i++) {
                    __buf[args.value + i] = str.charCodeAt(i);
                }
                return str.length + 1;
            case 3:
                var sub = new Object();
                var r;
                sub.st = args.subtype;
                sub.deep = self.deep + 1;
                if (args.index == 0) {
                    sub.indata = self.indata[args.tagname];
                } else {
                    sub.indata = self.indata[args.tagname][args.index-1];
                }
                r = sproto_encode(args.subtype, args.value, encode, sub);
                return r;
            default:
                return -1;
            }
        }

        function gen_response(response, session) {
            return function(args) {
                header_tmp = {}
                header_tmp.type = null;
                header_tmp.session = session;
                var header = sproto.encode(sproto.__package, header_tmp);
                if (response) {
                    var content = sproto.encode(response, args);
                    return sproto.pack(array_concat(header, content));
                } else {
                    return sproto.pack(header);
                }
            }
        }

        sproto.encode = function(type, indata) {
            var self = new Object();
            var st = sproto_type(type);
            var tbl_index = 2;
            __buf = new Array();
            self.st = st;
            self.tbl_index = tbl_index;
            self.indata = indata;
            for (;;) {
                var r;
                self.array_tag = null;
                self.array_index = 0;
                self.deep = 0;
                self.iter_index = tbl_index + 1;
                if (sproto_encode(st, 0, encode, self) < 0) {
                    return null;
                } else {
                    return {buf:__buf, sz:__buf.length};
                }
            }
        }

        function objlen(type, inbuf) {
            var ud = new Object();
            ud.array_tag = null;
            ud.deep = 0;
            ud.result = new Object();
            return sproto_decode(sproto_type(type), inbuf.buf, inbuf.sz, decode, ud);
        }

        sproto.decode = function(type, inbuf) {
            var buffer = inbuf.buf;
            var sz = inbuf.sz;
            var ud = new Object();
            ud.array_tag = null;
            ud.deep = 0;
            ud.result = new Object();
            if (sproto_decode(sproto_type(type), buffer, sz, decode, ud) == null) {
                return null;
            } else {
                return ud.result;
            }
        }

        sproto.pack = function(inbuf) {
            var tmp = new Array();
            var i, ff_srcstart, ff_desstart;
            ff_srcstart = new Array();
            var ff_srcstart_idx = 0;
            var ff_n = 0;
            var size = 0;
            var src = inbuf.buf;
            var buffer = new Array();
            var srcsz = inbuf.sz;
            var src_idx = 0;
            var buffer_idx = 0;
            var bufsz = 1<<30;
            function write_ff(src, des_idx, nn) {
                var i;
                var align8_n = (nn + 7) & (~7);
                buffer[des_idx] = 0xff;
                buffer[des_idx + 1] = align8_n / 8 -1;
                for (i = 0; i < nn; i++) {
                    buffer[des_idx + 2 + i] = src[i];
                }
                for (i = 0; i < align8_n - nn; i++) {
                    buffer[des_idx + nn + 2 + i] = 0;
                }
            }

            function pack_seg(s_idx, b_idx, sz, nn) {
                var header = 0;
                var notzero = 0;
                var i;
                var obuffer_idx = b_idx;
                b_idx++;
                sz--;
                if (sz < 0) {
                    obuffer_idx = null;
                }
                for (i = 0; i < 8; i++) {
                    if (src[s_idx + i] != 0) {
                        notzero++;
                        header |= 1 << i;
                        if (sz > 0) {
                            buffer[b_idx] = src[s_idx + i];
                            ++b_idx;
                            --sz;
                        }
                    }
                }
                if ((notzero == 7 || notzero == 6) && nn > 0) {
                    notzero = 8;
                }
                if (notzero == 8) {
                    if (nn > 0) {
                        return 8;
                    } else {
                        return 10;
                    }
                }
                if (obuffer_idx != null) {
                    buffer[obuffer_idx] = header;
                }
                return notzero + 1;
            }

            for (i = 0; i < srcsz; i += 8) {
                var n;
                var padding = i + 8 - srcsz;
                if (padding > 0) {
                    var j;
                    for (var k = 0; k < 8 - padding; k++) {
                        tmp[k] = src[src_idx + k];
                    }
                    for (j = 0; j < padding; j++) {
                        tmp[7 - j] = 0;
                    }
                    src = tmp;
                    src_idx = 0;
                }
                n = pack_seg(src_idx, buffer_idx, bufsz, ff_n);
                bufsz -= n;
                if (n == 10) {
                    ff_srcstart = src.slice(src_idx);
                    ff_srcstart_idx = src_idx;
                    ff_desstart = buffer_idx;
                    ff_n = 1;
                } else if (n == 8 && ff_n > 0) {
                    ++ff_n;
                    if (ff_n == 256) {
                        if (bufsz >= 0) {
                            write_ff(ff_srcstart, ff_desstart, 256 * 8);
                        }
                        ff_n = 0;
                    }
                } else {
                    if (ff_n > 0) {
                        if (bufsz >= 0) {
                            write_ff(ff_srcstart, ff_desstart, ff_n * 8);
                        }
                        ff_n = 0;
                    }
                }
                src_idx += 8;
                buffer_idx += n;
                size += n;
            }
            if (bufsz >= 0) {
                if (ff_n == 1) {
                    write_ff(ff_srcstart, ff_desstart, 8);
                } else if (ff_n > 1) {
                    write_ff(ff_srcstart, ff_desstart, srcsz - ff_srcstart_idx);
                }
            }
            return {buf: buffer, sz:size};
        }

        sproto.unpack = function(inbuf) {
            var srcv = inbuf.buf;
            var srcsz = inbuf.sz;
            var bufferv = new Array();
            var bufsz = 1 << 30;
            var src = srcv;
            var src_idx = 0;
            var buffer = bufferv;
            var buffer_idx = 0;
            var size = 0;
            while (srcsz > 0) {
                var header = src[src_idx];
                --srcsz;
                ++src_idx
                if (header == 0xff) {
                    var n;
                    if (srcsz < 0) {
                        return null;
                    }
                    n = (src[src_idx] + 1) * 8;
                    if (srcsz < n + 1) {
                        return null;
                    }
                    srcsz -= n + 1;
                    src_idx++
                    if (bufsz >= n) {
                        for (var i = 0; i < n; i++) {
                            buffer[buffer_idx + i] = src[src_idx + i];
                        }
                    }
                    bufsz -= n;
                    buffer_idx += n;
                    src_idx += n;
                    size += n;
                } else {
                    var i;
                    for (i = 0; i < 8; i++) {
                        var nz = (header >>> i) & 1;
                        if (nz != 0) {
                            if (srcsz < 0) {
                                return null;
                            }
                            if (bufsz > 0) {
                                buffer[buffer_idx] = src[src_idx];
                                --bufsz;
                                ++buffer_idx;
                            }
                            ++src_idx;
                            --srcsz;
                        } else {
                            if (bufsz > 0) {
                                buffer[buffer_idx] = 0;
                                --bufsz;
                                ++buffer_idx;
                            }
                        }
                        ++size;
                    }
                }
            }
            return {buf: buffer, sz: size}
        }

        sproto.protocol = sproto_protoquery;
        sproto.pencode = function(type, buf) {
            var o = sproto.encode(type, buf);
            if (o == null) {
                return null;
            }
            return sproto.pack(o);
        }

        sproto.pdecode = function(type, buf) {
            var o = sproto.unpack(buf);
            if (o == null) {
                return null;
            }
            return sproto.decode(type, o);
        }

        sproto.host = function(packagename) {
            sproto.__package = packagename;
            sproto.__session = new Array();
            return sproto
        }

        sproto.attach = function(sp) {
            sproto.sp = sp
            return function (name, args, session) {
                var proto = sproto_protoquery_name(name,sp);
                var header_tmp = {};
                header_tmp.type = proto.tag;
                header_tmp.session = session;
                var header = sproto.encode(sproto.__package, header_tmp);
                if (session) {
                    sproto.__session[session] = proto.p[1] ? proto.p[1] : {name:name}
                }
                if (args) {
                    var content = sproto.sp.encode(proto.p[0].name, args);
                    return sproto.sp.pack(array_concat(header, content));
                } else {
                    return sproto.sp.pack(header);
                }
            }
        }

        var pcache = {};
        function queryproto(pname){
            var v = pcache[pname];
            if(!v){
                var tag = sproto_protoname(pname);
                var req = sproto.protocol(pname, 0);
                var resp = sproto.protocol(pname, 1);
                if(!isNaN(pname)){
                    var tmp = pname;
                    pname = tag;
                    tag = tmp;
                }
                v = {
                    request : req,
                    response :resp,
                    name : pname,
                    tag : tag,
                }
                pcache[pname] = v;
                pcache[tag] = v
            }
            return v;
        }

        sproto.dispatch = function(buf, req_cb, rsp_cb) {
            var bin = sproto.unpack(buf);
            var header = sproto.decode(sproto.__package, bin);
            var len = objlen(sproto.__package, bin);
            var content = bin.buf.slice(len);
            if (header.type) {
                var proto = queryproto(header.type);
                var result = null;
                if (proto.request) {
                    result = sproto.decode(proto.request.name, {buf:content, sz:content.length});
                }
                if (header.session) {
                    return req_cb(proto.name, result, gen_response(proto.response, header.session));
                } else {
                    return req_cb(proto.name, result, null, null);
                }
            } else {
                if (!header.session) {
                    console.log("session not found");
                }
                session = header.session;
                if (!sproto.__session[session]) {
                    console.log("session not found");
                }
                response = sproto.__session[session];
                sproto.__session[session] = null;
                if (!response.f) {
                    return rsp_cb(session,response.name, null);
                } else {
                    var result = sproto.sp.decode(response.name, {buf: content, sz: content.length});
                    return rsp_cb(session,response.name, result);
                }
            }
        }
        
        return create(data.buf, data.sz);
    }
}

function arr2ab(array) {
    var len = array.length;
    var b = new ArrayBuffer(len + 2);
    var v = new DataView(b, 0);
    v.setUint16(0,len);
    for (var i = 0; i < array.length; i++) {
        v.setUint8(i + 2, array[i]);
    }
    return b;
}

function ab2arr(buffer) {
    var v = new DataView(buffer, 0);
    var a = new Array();
    var len = v.getUint16(0);
    for (var i = 0; i < len; i++) {
        a[i] = v.getUint8(i+2);
    }
    return a;
}