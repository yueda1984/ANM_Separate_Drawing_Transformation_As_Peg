/*
	Separate Drawing Transformation As Peg

	A Toon Boom Harmony shelf script that creates new pegs from selected drawings' transformations.
	The processed drawings' transformations will be cleared, while their "Animate Using Animation Tools" box get checked off.
	Users can use this to separate transformations from all the selected drawings. 
	Only tested on Harmony 17 but this should work on earlier and later versions.


	Installation:
	
	1) Download and Unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html
	   
	3) There is a folder named src inside the zip file. Copy all its contents directly to the folder above.
	4) In Harmony, add ANM_Separate_Drawing_Transformation_As_Peg function to any toolbar.

	
	Direction:

	1) Select drawings that you want to separate their transformations from.		
	2) Run ANM_Separate_Drawing_Transformation_As_Peg.	

	
	Author:

		Yu Ueda		
		Many more useful scripts for Toon Boom Harmony are available. Please visit raindropmoment.com	
*/


var scriptVar = "1.00";


function ANM_Separate_Drawing_Transformation_As_Peg()
{	
	var sNodes = selection.selectedNodes();
	var drawings = sNodes.filter(function(item){return node.type(item) === "READ";});
	if (drawings.length < 1)
	{
		MessageBox.information("Please select drawing nodes before running this script.");
		return;
	}
	
	scene.beginUndoRedoAccum("Separate Drawing Transformation As Peg");

	for (var dr = 0; dr < drawings.length; dr++)
	{
		var curDrawing = drawings[dr];

		// Get information of the selected drawing.
		var coordX = node.coordX(curDrawing);
		var coordY = node.coordY(curDrawing);				
		var parGroup = node.parentNode(curDrawing);		
		var drawingName = node.getName(curDrawing);
		
		// Create a new peg above the current drawing.
		var newPegName = getUniqueName(drawingName + "-P", "node", parGroup);
		var newPeg = node.add(parGroup, newPegName, "PEG", coordX, coordY -25, 0);

		var isPosSeparate = node.getAttr(curDrawing, 1, "offset.separate").boolValue();
		node.setTextAttr(newPeg, "position.separate", 1, isPosSeparate);		
		var isScaleSeparate = node.getAttr(curDrawing, 1, "scale.separate").boolValue();
		node.setTextAttr(newPeg, "scale.separate", 1, isScaleSeparate);		
		var isRotateSeparate = node.getAttr(curDrawing, 1, "rotation.separate").boolValue();
		node.setTextAttr(newPeg, "rotation.separate", 1, isRotateSeparate);		
		var is3D = node.getAttr(curDrawing, 1, "enable3d").boolValue();
		node.setTextAttr(newPeg, "enable3d", 1, is3D);	
		
		// Create transformation attribute columns to the peg, then move transformation keys on the drawing to the peg.
		var drawingAttrList = [
								"offset.x",
								"offset.y",
								"offset.z",
								"offset.2DPOINT",
								"offset.3DPATH",
								"scale.x",
								"scale.y",
								"scale.z",
								"scale.xy",
								"rotation.anglex",
								"rotation.angley",
								"rotation.anglez",
								"rotation.QUATERNIONPATH",
								"skew"
		];
		var pegAttrList = [];
		drawingAttrList.forEach(function(item){
			if (item.indexOf("offset") !== -1)
				pegAttrList.push(item.replace("offset", "position"));
			else
				pegAttrList.push(item);});
		
		for (var at = 0; at < drawingAttrList.length; at++)	
		{
			var columnHasKey = false;
			var srcCol = node.linkedColumn(curDrawing, drawingAttrList[at]);
			if (srcCol !== "")
			{
				var pasteCol = getUniqueName(pegAttrList[at], "column");
				if (pegAttrList[at].indexOf("2DPOINT") !== -1 || pegAttrList[at].indexOf("3DPATH") !== -1)					
					column.add(pasteCol, "3DPATH");
				else if (pegAttrList[at].indexOf("QUATERNIONPATH") !== -1)	
					column.add(pasteCol, "QUATERNIONPATH");				
				else
					column.add(pasteCol, "BEZIER");
				node.linkAttr(newPeg, pegAttrList[at], pasteCol);
				
				columnHasKey = copyKeyframes(srcCol, pasteCol, drawingAttrList[at]);
	
				// Unlink and remove the column from the current drawing.
				if (node.unlinkAttr(curDrawing, drawingAttrList[at]))
					column.removeUnlinkedFunctionColumn(srcCol);		
			}
			// This is the case where current attribute has a column with no keyframes.
			// Fetch the transformation value from the local instead.
			if (!columnHasKey)
			{
				var val = node.getAttr(curDrawing, 1, drawingAttrList[at]).doubleValue();
				node.setTextAttr(newPeg, pegAttrList[at], 1, val);	
			}
			
			// Set the transformation attributes their default values.
			if (drawingAttrList[at].indexOf("scale") !== -1)
				node.setTextAttr(curDrawing, drawingAttrList[at], 1, 1);
			else
				node.setTextAttr(curDrawing, drawingAttrList[at], 1, 0);
		}
		

		// Move pivot positions from the drawing to the peg.
		var pivotX = node.getAttr(curDrawing, 1, "pivot.x").doubleValue();
		var pivotY = node.getAttr(curDrawing, 1, "pivot.y").doubleValue();
		node.setTextAttr(newPeg, "pivot.x", 1, pivotX);
		node.setTextAttr(newPeg, "pivot.y", 1, pivotY);
		node.setTextAttr(curDrawing, "pivot.x", 1, 0);
		node.setTextAttr(curDrawing, "pivot.y", 1, 0);		
		if (node.getAttr(curDrawing, 1, "enable3d").boolValue())
		{
			var pivotZ = node.getAttr(curDrawing, 1, "pivot.z").doubleValue();
			node.setTextAttr(newPeg, "pivot.z", 1, pivotZ);
			node.setTextAttr(curDrawing, "pivot.z", 1, 0);	
		}
		
		if (node.getTextAttr(curDrawing, 1, "useDrawingPivot") === "Apply Embedded Pivot on Drawing Layer")
			node.setTextAttr(curDrawing, "useDrawingPivot", 1, "Apply Embedded Pivot on Parent Peg");		

		// Link the peg with the drawing.
		var src = node.srcNode(curDrawing, 0);
		if (src !== "")
		{
			var srcInfo = node.srcNodeInfo(curDrawing, 0);
			node.unlink(curDrawing, 0);
			node.link(srcInfo.node, srcInfo.port, newPeg, 0, false, false);
		}
		node.link(newPeg, 0, curDrawing, 0, false, false);

		// Set the drawing to the default, unanimatable state.		
		node.setTextAttr(curDrawing, "offset.separate", 1, true);
		node.setTextAttr(curDrawing, "scale.separate", 1, true);
		node.setTextAttr(curDrawing, "rotation.separate", 1, false);
		node.setTextAttr(curDrawing, "enable3d", 1, false);		
		node.setTextAttr(curDrawing, "canAnimate", 1, false);
	}

	scene.endUndoRedoAccum("");


	function getUniqueName(argName, mode, group /* for node only */)
	{
		var suffix = 0;
		var originalName = argName;
		
		if (mode === "element"){
			while (element.getNameById(argName))
			{
				suffix ++;
				argName = originalName + "_" + suffix;	
			}
		}
		else if (mode === "column")
		{			
			while (argName.indexOf("\.") !== -1)
			{
				argName = argName.replace("\.", "_");
			}			
			while (column.getDisplayName(argName))
			{
				suffix ++;
				argName = originalName + "_" + suffix;	
			}
		}
		else // mode === "node"
		{ 
			while (node.getName(group + "/" + argName))
			{
				suffix ++;
				argName = originalName + "_" + suffix;	
			}
		}		
		return argName;
	}

	
	function copyKeyframes(copySrcCol, pasteSrcCol, attrName)
	{
		var numPoints = 0
		
		// If the function column is in 2d/3d path mode
		if (attrName.indexOf(".2DPOINT") !== -1 ||
			attrName.indexOf(".3DPATH") !== -1 ||
			attrName.indexOf(".QUATERNIONPATH") !== -1)
		{
			numPoints = func.numberOfPointsPath3d(copySrcCol);
			for (var pt = 0; pt < numPoints; pt++)
			{
				var fr = func.pointX(copySrcCol, pt);			
				var valueX = func.pointXPath3d(copySrcCol, pt);
				var valueY = func.pointYPath3d(copySrcCol, pt);
				var valueZ = func.pointZPath3d(copySrcCol, pt);				
				var tension = func.pointTensionPath3d(copySrcCol, pt);
				var continuity = func.pointContinuityPath3d(copySrcCol, pt);
				var bias =  func.pointBiasPath3d(copySrcCol, pt);
				var boolConstSeq = func.pointConstSeg(copySrcCol, pt);					
				
				func.addKeyFramePath3d(pasteSrcCol, fr, valueX, valueY, valueZ, tension, continuity, bias);					
				func.setPath3dPointConstantSegment(pasteSrcCol, pt, boolConstSeq);	
			}
		} // Else if function column is in separate mode
		else
		{		
			numPoints = func.numberOfPoints(copySrcCol);
			for (var pt = 0; pt < numPoints; pt++)
			{
				var fr = func.pointX(copySrcCol, pt);
				var value = func.pointY(copySrcCol, pt);
				var boolConstSeq = func.pointConstSeg(copySrcCol, pt);				
				var continuity = func.pointContinuity(copySrcCol, pt);
				var HandleLX = func.pointHandleLeftX(copySrcCol, pt);
				var HandleLY = func.pointHandleLeftY(copySrcCol, pt);
				var HandleRX = func.pointHandleRightX(copySrcCol, pt);
				var HandleRY = func.pointHandleRightY(copySrcCol, pt);
				// This debugs issue with handles. It returns true if success.				
				if (func.setBezierPoint(pasteSrcCol, fr, 0, 0, 0, 0, 0, boolConstSeq, continuity))
					func.setBezierPoint(pasteSrcCol, fr, value, HandleLX, HandleLY, HandleRX, HandleRY, boolConstSeq, continuity);
				else // Current key is an ease key.
				{
					var pointEaseIn = func.pointEaseIn(copySrcCol, pt);
					var angleEaseIn = func.angleEaseIn(copySrcCol, pt);
					var pointEaseOut = func.pointEaseOut(copySrcCol, pt);
					var angleEaseOut = func.angleEaseOut(copySrcCol, pt);
					func.setEasePoint(pasteSrcCol, fr, value, pointEaseIn, angleEaseIn, pointEaseOut, angleEaseOut, boolConstSeq, continuity);					
				}
			}
		}
		return (numPoints < 1) ? false: true;
	}
}