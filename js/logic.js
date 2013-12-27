var crypter = false;

Handler = {
	el: null,
	context: null,
	init: function(){
		this.el = $('#handler')[0];
		this.context = this.el.getContext('2d');
	},
};

Preview = {
	idle: true,
	el: null,
	context: null,
	init: function(){
		if(!crypter) return;
		this.el = $('#preview')[0];
		this.context = this.el.getContext('2d');
	},
	
	/**
	* @param bits is how much HIGHER bits to save
	*/
	preserveMostSignificantBits: function(bits){
		if(this.idle){ return; }
		
		if(bits == undefined){ bits = 2; }
		
		var offset = 8 - bits;
		var mask = (255 >> offset) << offset;
		
		var d = this.context.getImageData(0, 0, this.el.width, this.el.height);
		
		for(var i = (d.data.length-1); i >= 0; i-=4){
			d.data[i-1] = Crypter.source.data[i-1] & mask;
			d.data[i-2] = Crypter.source.data[i-2] & mask;
			d.data[i-3] = Crypter.source.data[i-3] & mask;
		}
		
		this.context.putImageData(d,0,0);
	},
};

Crypter = {
	msb: 0,
	/**
	* @desc both source and container remains unchanged all the time (untill you drop another images)
	*       and only used as data source to calculate a new image data
	*/
	source: 0,      //what to hide (ImageData obj)
	container: 0,   //where to hide (ImageData obj)
	
	/**
	* @param bits: how many LOWER bits in container to replace
	*/
	changeLowerBitsToHigher: function(bits){
		var dsrc = this.source;
		var dc = this.container;
		var d = Handler.context.getImageData(0, 0, Handler.el.width, Handler.el.height);
		
		if(bits == undefined){ bits = 2; }
		var offset = 8 - bits;
		var mask = (255 >> bits) << bits;
		
		//store bits in blue channel of the last pixel
		var last_pxl_blue = d.data[d.data.length-2];
		d.data[d.data.length-2] = ((last_pxl_blue >> 3) << 3) | bits;
		
		//encoding image dimensions
		var w = dsrc.width;
		var h = dsrc.height;
		var d_mask = 255 >> 5;
		var e_mask = ((255 >> 3) << 3);
		var src = w;
		for(var i = d.data.length-6,ctr=0; ctr < 8; i-=4,ctr++){
			if(ctr == 4) src = h;
			//replace 3 lower bits by 0
			d.data[i] &= e_mask;
			d.data[i] |= (src & d_mask);
			src >>= 3;
		}
		
		//begin from second (from end) pixel
		for(var i = 0; i < dsrc.data.length; i+=4){
			//set lower bits to zero
			d.data[i]   = dc.data[i]   & mask;    //red
			d.data[i+1] = dc.data[i+1] & mask;    //green
			d.data[i+2] = dc.data[i+2] & mask;    //blue
			
			//change lower bits to higher bits of source
			d.data[i]   |= (dsrc.data[i]   >> offset);
			d.data[i+1] |= (dsrc.data[i+1] >> offset);
			d.data[i+2] |= (dsrc.data[i+2] >> offset);
		}
		
		console.log('last pixel:', i); //this will be the next red value in the pixel after source image
		d.data[i+3] = 254;  //changing alpha of the last+1 pixel to mark the end of crypted message;
		
		Handler.context.putImageData(d,0,0);
	},
};

function dragOverHandler(e){
	e.originalEvent.stopPropagation();
	e.originalEvent.preventDefault();
	e.originalEvent.dataTransfer.dropEffect = 'copy';
}

function dropHandler(e){
	e.originalEvent.stopPropagation();
	e.originalEvent.preventDefault();
	
	var files = e.originalEvent.dataTransfer.files;
	var fr = new FileReader();
	var img = new Image();
	
	img.onload = function(){
		var id = e.currentTarget.id;
		console.log('id:', id);
		if(id == 'what'){
			Preview.el.width = this.width;
			Preview.el.height = this.height;
			Preview.context.drawImage(this, 0, 0);
			Preview.idle = false;
			Crypter.source = Preview.context.getImageData(0,0, Preview.el.width, Preview.el.height);
			$('#bits-range').trigger('change');
			$(e.currentTarget).parent().fadeOut(200, function(){
				$('#where').parent().fadeIn();
			});
			
		} else if(id == 'where') {
			Handler.el.width = this.width;
			Handler.el.height = this.height;
			Handler.context.drawImage(this, 0, 0);
			Crypter.container = Handler.context.getImageData(0,0, Handler.el.width, Handler.el.height);
			if(!crypter){
				$('#where').parent().fadeOut(200, function(){
					$('.result-wrapper').fadeIn();
					$('#given').fadeIn();
					var cryptedImage = Handler.el.toDataURL();
					$('#given').attr('src', cryptedImage);
					return;
				});
			}
			$('#where').parent().fadeOut(200, function(){
				$('.range-wrap').fadeIn();
			});
		}
		
		//$('div.drop-wrapper').addClass('invisible');
		//$('div.result-wrapper').removeClass('invisible');
	}
	
	fr.onload = function(){
		img.src = fr.result;
	}
	
	fr.readAsDataURL(files[0]);
}

function crypt(){
	var bits = parseInt($('#bits-range').val());
	
	Crypter.changeLowerBitsToHigher(bits);
	
	var result = Handler.el.toDataURL();

	//result = result.replace('image/png', 'image/octet-stream');
	$('#result').ready(function(){
		$('.res').fadeIn();
		$('.range-wrap').fadeOut();
	});
	$('#result').attr({'src': result});

}
var decrdata = 0;
function decrypt(){
	var dc = Crypter.container;
	var bits = dc.data[dc.data.length-2] & 7;
	console.log('bits of color information:', bits);
	var offset = 8 - bits;
	var mask = 255 >> offset;
	
	//decrypt image dimensions (warning! below code is shit! Gonna rewrite it later)
	var w = 0, h = 0, rcv = 0;
	var d_mask = 255 >> 5;
	for(var i = dc.data.length - 6, ctr = 0; ctr < 4; ctr++, i-=4){
		w |= ((dc.data[i] & d_mask) << (3*ctr));
	}
	
	for(var i = dc.data.length - 22, ctr = 0; ctr < 4; ctr++, i-=4){
		h |= ((dc.data[i] & d_mask) << (3*ctr));
	}
	
	console.log('width, height:', w, h);
	
	var d = Handler.context.createImageData(w, h);
	Handler.el.width = w;
	Handler.el.height = h;
	
	for(var i = 0; i < dc.data.length; i+=4){
		if(dc.data[i+3] == 254){ console.log('msg end, last pixel:', i); break; }
		d.data[i]   = (dc.data[i]   & mask) << offset;
		d.data[i+1] = (dc.data[i+1] & mask) << offset;
		d.data[i+2] = (dc.data[i+2] & mask) << offset;
		//SAVE ALPHA CHANNEL!
		d.data[i+3] = dc.data[i+3];
	}
	
	console.log('decryption ended, last i:', i, 'data[2] val:', d.data[2]);
	decrdata = d;
	Handler.context.putImageData(d,0,0);
	var result = Handler.el.toDataURL();

	//result = result.replace('image/png', 'image/octet-stream');
	
	
	$('#result').ready(function(){
		$('.res').fadeIn();
		$('.result-wrapper, #given').fadeOut();
	});
	
	$('#result').attr({'src': result});
}

function onRangeChange(){
	var val = parseInt($(this).val());
	$('.range-display').text(val);
	Preview.preserveMostSignificantBits(parseInt(val));
}

function restart(){
	$('.res').fadeOut(0);
	if(!crypter){
		$('#where').parent().fadeIn();
	} else {
		$('#what').parent().fadeIn();
	}
}

$(function(){
	console.log('hello');
	var available = false;
	if(window.File && window.FileReader && window.FileList && window.Blob){
		available = true;
	} else {
		alert('The File API is not fully supported in your browser, get something modern bro!');
	}
	
	if(!available){
		return;
	}
	
	if($('body').attr('id') == 'crypter'){
		crypter = true;
		var cryptBtn = $('#crypt');
		cryptBtn.on('click', crypt);
	} else {
		var deCryptBtn = $('#decrypt');
		deCryptBtn.on('click', decrypt);
	}
	
	Handler.init();
	Preview.init();
	
	var dropZone = $('div.drop-zone');
	dropZone.on('dragover', dragOverHandler);
	dropZone.on('drop', dropHandler);
	
	$('#bits-range').on('change', onRangeChange);
	$('#repeat').on('click', restart);
	
	//init trigger to default value
	$('#bits-range').trigger('change');
});